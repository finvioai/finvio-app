import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'
import { extractDocumentData } from '@/lib/llm/documentExtractor'
import type { DocumentType } from '@/lib/llm/documentExtractor'
import type { PendingAction } from '@/types'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  // 5 MB
const MAX_TEXT_CHARS = 4_000
const UPLOAD_RATE_LIMIT = 5                   // uploads per hour per org

// Friendly labels for document types shown in the extraction message
const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  receipt:              'receipt',
  invoice_received:     'invoice',
  invoice_sent:         'invoice',
  quotation:            'quotation',
  payment_confirmation: 'payment confirmation',
  unknown:              'document',
}

async function checkUploadRateLimit(orgId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'user')
    .like('content', '📎%')
    .gte('created_at', oneHourAgo)

  return (count ?? 0) < UPLOAD_RATE_LIMIT
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
  const orgId = member.org_id

  // ── Parse multipart body ──────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const provider = (formData.get('provider') as string | null) ?? 'openai'
  const model    = (formData.get('model')    as string | null) ?? 'gpt-4o-mini'
  const sessionId = formData.get('sessionId') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // ── Validate file type ────────────────────────────────────────────────────
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are supported. Please upload a .pdf file.' },
      { status: 415 }
    )
  }

  // ── Validate file size ────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Maximum size is 5 MB (your file: ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
      { status: 413 }
    )
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  const withinLimit = await checkUploadRateLimit(orgId, supabase)
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Upload limit reached (5 per hour). Please wait before uploading another document.' },
      { status: 429 }
    )
  }

  // ── Extract text from PDF via pdfjs-dist ─────────────────────────────────
  let extractedText = ''
  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)

    // Use pdfjs-dist legacy build. Build the worker path from process.cwd()
    // so it resolves correctly in both dev and production (no bundler involved
    // because pdfjs-dist is in serverExternalPackages in next.config.ts).
    const { join } = await import('path')
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerPath = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`

    const loadingTask = pdfjs.getDocument({ data: uint8, verbosity: 0 })
    const doc = await loadingTask.promise

    const pageTexts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? (item as { str: string }).str : ''))
        .join(' ')
      pageTexts.push(text)
      page.cleanup()
    }
    await doc.destroy()
    extractedText = pageTexts.join('\n')
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[chat/upload] PDF extraction error:', errMsg)
    return NextResponse.json({
      message: `[debug] PDF error: ${errMsg}`,
      pendingAction: null,
      sessionId: sessionId ?? undefined,
    })
  }

  // ── Resolve or create session ─────────────────────────────────────────────
  let chatSessionId: string
  if (sessionId) {
    chatSessionId = sessionId
  } else {
    const { data: session, error: sessionErr } = await supabase
      .from('chat_sessions')
      .insert({ org_id: orgId, user_id: user.id, title: `📎 ${file.name}` })
      .select('id')
      .single()
    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
    }
    chatSessionId = session.id
  }

  // ── Not enough text extracted ─────────────────────────────────────────────
  if (extractedText.trim().length < 30) {
    const noTextMsg = "I couldn't extract readable text from this PDF. Make sure it's a text-based PDF (not a scanned image), or paste the content as a message instead."

    await supabase.from('chat_messages').insert([
      { session_id: chatSessionId, org_id: orgId, role: 'user',      content: `📎 ${file.name}` },
      { session_id: chatSessionId, org_id: orgId, role: 'assistant', content: noTextMsg },
    ])

    return NextResponse.json({ message: noTextMsg, pendingAction: null, sessionId: chatSessionId })
  }

  // ── LLM extraction ────────────────────────────────────────────────────────
  const truncatedText = extractedText.slice(0, MAX_TEXT_CHARS)
  const extracted = await extractDocumentData(truncatedText, provider, model)

  // ── Build response message ────────────────────────────────────────────────
  let responseMessage: string
  let pendingAction: PendingAction | null = extracted.pendingAction

  if (pendingAction) {
    const label = DOC_TYPE_LABEL[extracted.documentType]
    const fields = extracted.extractedFields as Record<string, unknown>
    const vendor = String(fields.vendor ?? '')
    const amount = typeof fields.amount === 'number' ? fields.amount : parseFloat(String(fields.amount ?? '0'))
    const date   = String(fields.date ?? '')
    const vendorPart = vendor ? ` from **${vendor}**` : ''
    const amountPart = amount > 0 ? ` for **$${amount.toLocaleString()}**` : ''
    const datePart   = date   ? ` dated ${date}` : ''

    responseMessage = `I found a ${label}${vendorPart}${amountPart}${datePart}. Does this look right?`
    if (extracted.confidence === 'low') {
      responseMessage += ' The details looked uncertain — please review carefully before confirming.'
    }
  } else {
    responseMessage =
      "I wasn't able to identify a clear financial document in this PDF. Please check the file, or try describing the transaction as a message instead."
    pendingAction = null
  }

  // ── Persist messages ──────────────────────────────────────────────────────
  await supabase.from('chat_messages').insert([
    {
      session_id: chatSessionId,
      org_id: orgId,
      role: 'user',
      content: `📎 ${file.name}`,
    },
    {
      session_id: chatSessionId,
      org_id: orgId,
      role: 'assistant',
      content: responseMessage,
      data_context: pendingAction
        ? (JSON.parse(JSON.stringify({ pendingAction })) as Json)
        : null,
    },
  ])

  return NextResponse.json({ message: responseMessage, pendingAction, sessionId: chatSessionId })
}
