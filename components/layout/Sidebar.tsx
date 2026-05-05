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
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
  FolderOpen,
  BookOpen,
  Scale,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const primaryItems = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/revenue',      label: 'Revenue',      icon: TrendingUp },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/expenses',     label: 'Expenses',     icon: Receipt },
  { href: '/invoices',     label: 'Invoices',     icon: FileText },
  { href: '/reports',        label: 'Reports',        icon: BarChart3 },
  { href: '/balance-sheet', label: 'Balance Sheet', icon: Scale },
  { href: '/projects',      label: 'Projects',       icon: FolderOpen },
  { href: '/advisor',      label: 'AI Advisor',   icon: Bot },
  { href: '/connections',  label: 'Connections',  icon: Plug },
]

const moreItems = [
  { href: '/forecast',         label: 'Forecast',         icon: TrendingDown },
  { href: '/scenarios',        label: 'Scenarios',        icon: FlaskConical },
  { href: '/investor-updates', label: 'Investor Updates', icon: Mail },
  { href: '/import',           label: 'Import Data',      icon: Upload },
  { href: '/glossary',         label: 'Glossary',         icon: BookOpen },
]

interface SidebarProps {
  userEmail?: string
  orgName?: string
}

export function Sidebar({ userEmail, orgName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isMoreActive = moreItems.some(({ href }) => pathname === href || pathname.startsWith(href))
  const [moreOpen, setMoreOpen] = useState(isMoreActive)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'FP'

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <span className="text-lg font-bold text-gray-900">Finvio</span>
      </div>

      {/* Org badge */}
      {orgName && (
        <div className="px-4 pt-3 pb-1">
          <div className="rounded-md bg-gray-50 px-3 py-1.5">
            <p className="text-xs font-medium text-gray-500 truncate">{orgName}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {primaryItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
              {label}
              {label === 'AI Advisor' && (
                <span className="ml-auto rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                  AI
                </span>
              )}
            </Link>
          )
        })}

        {/* More section */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isMoreActive ? 'text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200',
                moreOpen ? 'rotate-90' : 'rotate-0',
                isMoreActive ? 'text-blue-600' : 'text-gray-400'
              )}
            />
            More
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              moreOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="space-y-0.5 pl-2 pt-0.5">
              {moreItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-200 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-100 transition-colors outline-none">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-xs font-medium text-gray-900 truncate">{userEmail}</p>
              <p className="text-xs text-gray-500">Free plan</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <DropdownMenuItem render={<Link href="/settings" />}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
