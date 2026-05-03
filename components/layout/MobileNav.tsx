'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  FileText,
  BarChart3,
  TrendingDown,
  Bot,
  FlaskConical,
  Mail,
  Plug,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeftRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/revenue', label: 'Revenue', icon: TrendingUp },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/forecast', label: 'Forecast', icon: TrendingDown },
  { href: '/advisor', label: 'AI Advisor', icon: Bot },
  { href: '/scenarios', label: 'Scenarios', icon: FlaskConical },
  { href: '/investor-updates', label: 'Investor Updates', icon: Mail },
  { href: '/connections', label: 'Connections', icon: Plug },
  { href: '/import', label: 'Import Data', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface MobileNavProps {
  userEmail?: string
  orgName?: string
}

export function MobileNav({ userEmail, orgName }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 transition-colors">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">Finvio</span>
            </div>
            <button onClick={() => setOpen(false)}>
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {orgName && (
            <div className="px-4 pt-3 pb-1">
              <div className="rounded-md bg-gray-50 px-3 py-1.5">
                <p className="text-xs font-medium text-gray-500 truncate">{orgName}</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 space-y-2">
            {userEmail && (
              <p className="text-xs text-gray-500 truncate px-1">{userEmail}</p>
            )}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
