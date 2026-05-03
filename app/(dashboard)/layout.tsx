import { redirect } from 'next/navigation'
import { getSession, getOrgInfo } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { FloatingAdvisorButton } from '@/components/chat/FloatingAdvisorButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getSession() reads the JWT locally — no network call to Supabase auth server.
  // Middleware already validated the session, so this is safe for display use.
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  // getOrgInfo() is cached for 5 min (unstable_cache) and deduplicated within
  // the same render (React.cache), so layout + page share one DB call.
  const { orgName } = await getOrgInfo()
  const userEmail = session.user.email ?? undefined

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar userEmail={userEmail} orgName={orgName ?? undefined} />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <MobileNav userEmail={userEmail} orgName={orgName ?? undefined} />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-base font-bold text-gray-900">Finvio</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <FloatingAdvisorButton />
      </div>
    </div>
  )
}
