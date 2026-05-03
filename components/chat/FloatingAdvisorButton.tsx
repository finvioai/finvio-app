'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot } from 'lucide-react'

export function FloatingAdvisorButton() {
  const pathname = usePathname()
  if (pathname === '/advisor') return null

  return (
    <Link
      href="/advisor"
      aria-label="Open AI Advisor"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg hover:bg-blue-700 active:scale-95 transition-all duration-150 md:bottom-8 md:right-8"
    >
      <Bot className="h-6 w-6 text-white" />
    </Link>
  )
}
