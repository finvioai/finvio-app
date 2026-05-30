import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI, { toFile } from 'openai'

const MAX_BYTES = 24 * 1024 * 1024 // 24 MB — Whisper limit is 25 MB
const ALLOWED_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  // ── Quota check ───────────────────────────────────────────────────────────
  const dailyQuota = parseInt(process.env.VOICE_DAILY_QUOTA_SECONDS ?? '300')
  const monthlyQuota = parseInt(process.env.VOICE_MONTHLY_QUOTA_SECONDS ?? '3600')
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [{ data: daily }, { data: monthly }] = await Promise.all([
    db
      .from('voice_usage')
      .select('duration_seconds')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    db
      .from('voice_usage')
      .select('duration_seconds')
      .eq('user_id', user.id)
      .gte('date', monthStart),
  ])

  const dailyUsed = (daily?.duration_seconds as number) ?? 0
  const monthlyUsed = ((monthly ?? []) as Array<{ duration_seconds: number }>).reduce(
    (s, r) => s + r.duration_seconds,
    0
  )

  if (dailyUsed >= dailyQuota || monthlyUsed >= monthlyQuota) {
    return NextResponse.json(
      {
        error: dailyUsed >= dailyQuota ? 'Daily voice quota reached.' : 'Monthly voice quota reached.',
        dailyUsedSeconds: dailyUsed,
        dailyQuotaSeconds: dailyQuota,
        monthlyUsedSeconds: monthlyUsed,
        monthlyQuotaSeconds: monthlyQuota,
      },
      { status: 429 }
    )
  }
  // ─────────────────────────────────────────────────────────────────────────

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio provided' }, { status: 400 })

  // Normalize MIME type — browsers send 'audio/webm;codecs=opus' etc.
  const mimeBase = audio.type.split(';')[0].trim()
  if (!ALLOWED_TYPES.has(mimeBase)) {
    return NextResponse.json(
      { error: 'Unsupported audio type. Allowed: webm, mp4, mpeg, wav, ogg, m4a.' },
      { status: 415 }
    )
  }

  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Audio file too large. Maximum is 24 MB.' },
      { status: 413 }
    )
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Transcription not configured.' }, { status: 503 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const buffer = Buffer.from(await audio.arrayBuffer())
    // toFile() ensures correct multipart encoding in the Node.js server environment
    const file = await toFile(buffer, 'recording.webm', { type: 'audio/webm' })

    // verbose_json gives per-segment no_speech_prob so we can reject hallucinations.
    // Whisper hallucinates YouTube-style phrases ("thank you for watching", etc.) when
    // given silence or background noise; no_speech_prob close to 1.0 exposes this.
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
    }) as unknown as { text: string; duration?: number; segments?: Array<{ no_speech_prob: number }> }

    const segs = result.segments ?? []
    const allSilence = segs.length > 0 && segs.every((s) => s.no_speech_prob > 0.6)
    if (allSilence) return NextResponse.json({ text: '' })

    // ── Log duration ──────────────────────────────────────────────────────
    const actualSeconds = result.duration ?? 0
    if (actualSeconds > 0) {
      await db.from('voice_usage').upsert(
        { user_id: user.id, date: today, duration_seconds: dailyUsed + actualSeconds },
        { onConflict: 'user_id,date' }
      )
    }
    // ─────────────────────────────────────────────────────────────────────

    return NextResponse.json({ text: result.text ?? '' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Transcription failed'
    console.error('[transcribe]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
