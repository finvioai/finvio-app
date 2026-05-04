import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error, data: { session } } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && session) {
      // Apply the company name the user typed at signup. A DB trigger creates
      // the org with a generic default — overwrite it here with the real name.
      const orgName = session.user.user_metadata?.org_name as string | undefined
      if (orgName) {
        const svc = createServiceClient()
        const { data: member } = await svc
          .from('org_members')
          .select('org_id')
          .eq('user_id', session.user.id)
          .single()
        if (member?.org_id) {
          await svc
            .from('organizations')
            .update({ name: orgName })
            .eq('id', member.org_id)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
