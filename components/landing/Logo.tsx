import Link from 'next/link'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`text-xl font-extrabold tracking-tighter text-navy ${className}`}>
      FINVIO<span className="text-brand">.ai</span>
    </Link>
  )
}
