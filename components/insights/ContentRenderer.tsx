import { PortableText, type PortableTextComponents } from '@portabletext/react'
import Image from 'next/image'
import Link from 'next/link'
import { Info, Lightbulb, AlertTriangle, AlertCircle } from 'lucide-react'
import type { ContentBlock } from '@/sanity/lib/types'
import { cn } from '@/lib/utils'

function slugifyHeading(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}

const calloutConfig = {
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon_color: 'text-blue-500' },
  tip: { icon: Lightbulb, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon_color: 'text-green-500' },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon_color: 'text-yellow-500' },
  danger: { icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon_color: 'text-red-500' },
} as const

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className="mb-5 leading-7 text-navy/85">{children}</p>,
    h2: ({ children, value }) => {
      const text = (value?.children as { text?: string }[] | undefined)?.map((c) => c.text ?? '').join('') ?? ''
      const id = slugifyHeading(text)
      return <h2 id={id} className="mt-10 mb-4 text-2xl font-bold text-navy scroll-mt-24">{children}</h2>
    },
    h3: ({ children, value }) => {
      const text = (value?.children as { text?: string }[] | undefined)?.map((c) => c.text ?? '').join('') ?? ''
      const id = slugifyHeading(text)
      return <h3 id={id} className="mt-8 mb-3 text-xl font-bold text-navy scroll-mt-24">{children}</h3>
    },
    h4: ({ children }) => <h4 className="mt-6 mb-2 text-lg font-semibold text-navy">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-brand pl-5 italic text-muted-ink leading-relaxed">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="mb-5 ml-5 space-y-1.5 list-disc text-navy/85">{children}</ul>,
    number: ({ children }) => <ol className="mb-5 ml-5 space-y-1.5 list-decimal text-navy/85">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-7">{children}</li>,
    number: ({ children }) => <li className="leading-7">{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
      <code className="rounded bg-off-white border border-hairline px-1.5 py-0.5 font-mono text-sm text-brand">
        {children}
      </code>
    ),
    underline: ({ children }) => <span className="underline">{children}</span>,
    link: ({ value, children }) => {
      const href = value?.href ?? '#'
      const isExternal = href.startsWith('http')
      return isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2 hover:text-navy transition-colors">
          {children}
        </a>
      ) : (
        <Link href={href} className="text-brand underline underline-offset-2 hover:text-navy transition-colors">
          {children}
        </Link>
      )
    },
  },
  types: {
    imageBlock: ({ value }) => (
      <figure className={cn('my-8', value.fullWidth ? 'w-full' : 'max-w-2xl mx-auto')}>
        {value.imageUrl && (
          <div className="overflow-hidden rounded-xl border border-hairline">
            <Image
              src={value.imageUrl}
              alt={value.alt ?? ''}
              width={value.imageDimensions?.width ?? 1200}
              height={value.imageDimensions?.height ?? 675}
              className="w-full h-auto"
            />
          </div>
        )}
        {value.caption && (
          <figcaption className="mt-2 text-center text-xs text-muted-ink font-mono-eyebrow">
            {value.caption}
          </figcaption>
        )}
      </figure>
    ),

    callout: ({ value }) => {
      const cfg = calloutConfig[value.type as keyof typeof calloutConfig] ?? calloutConfig.info
      const Icon = cfg.icon
      return (
        <div className={cn('my-6 flex gap-3 rounded-xl border p-4', cfg.bg, cfg.border)}>
          <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', cfg.icon_color)} />
          <p className={cn('text-sm leading-relaxed', cfg.text)}>{value.text}</p>
        </div>
      )
    },

    codeBlock: ({ value }) => (
      <div className="my-6 overflow-hidden rounded-xl border border-hairline">
        {value.filename && (
          <div className="flex items-center gap-2 border-b border-hairline bg-off-white px-4 py-2">
            <span className="font-mono text-xs text-muted-ink">{value.filename}</span>
            {value.language && (
              <span className="ml-auto rounded bg-brand-tint px-1.5 py-0.5 text-xs font-semibold text-brand">
                {value.language}
              </span>
            )}
          </div>
        )}
        <pre className="overflow-x-auto bg-navy p-5">
          <code className="font-mono text-sm text-navy-foreground/90 leading-relaxed">
            {value.code}
          </code>
        </pre>
      </div>
    ),

    table: ({ value }) => (
      <div className="my-8 overflow-x-auto rounded-xl border border-hairline">
        {value.caption && (
          <div className="border-b border-hairline bg-off-white px-4 py-2">
            <p className="text-xs font-semibold text-muted-ink font-mono-eyebrow">{value.caption}</p>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody>
            {value.rows?.map((row: { _key: string; cells: string[]; isHeader: boolean }) => (
              <tr key={row._key} className={cn('border-b border-hairline/60 last:border-0', row.isHeader && 'bg-off-white')}>
                {row.cells?.map((cell: string, i: number) =>
                  row.isHeader ? (
                    <th key={i} className="px-4 py-2.5 text-left font-semibold text-navy text-xs uppercase tracking-wide">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className="px-4 py-2.5 text-navy/85">{cell}</td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    comparisonTable: ({ value }) => (
      <div className="my-8 overflow-x-auto rounded-xl border border-hairline">
        {value.title && (
          <div className="border-b border-hairline bg-navy px-4 py-3">
            <p className="text-sm font-bold text-navy-foreground">{value.title}</p>
          </div>
        )}
        <table className="w-full text-sm">
          {value.headers && (
            <thead>
              <tr className="border-b border-hairline bg-off-white">
                {value.headers.map((h: string, i: number) => (
                  <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-navy uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {value.rows?.map((row: { _key: string; cells: string[]; highlighted: boolean }) => (
              <tr
                key={row._key}
                className={cn(
                  'border-b border-hairline/60 last:border-0',
                  row.highlighted ? 'bg-brand-tint/50' : 'bg-white hover:bg-off-white/60'
                )}
              >
                {row.cells?.map((cell: string, i: number) => (
                  <td key={i} className={cn('px-4 py-2.5', row.highlighted && i === 0 ? 'font-semibold text-brand' : 'text-navy/85')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    faqBlock: ({ value }) => (
      <div className="my-8">
        {value.title && <h3 className="mb-4 text-lg font-bold text-navy">{value.title}</h3>}
        <div className="space-y-2">
          {value.items?.map((item: { _key: string; question: string; answer: string }) => (
            <details
              key={item._key}
              className="group rounded-xl border border-hairline bg-white overflow-hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 font-semibold text-navy hover:bg-off-white/60 transition-colors list-none">
                <span>{item.question}</span>
                <span className="shrink-0 text-brand group-open:rotate-45 transition-transform duration-200 text-xl leading-none">+</span>
              </summary>
              <div className="border-t border-hairline/60 px-5 py-4">
                <p className="text-sm leading-relaxed text-muted-ink">{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    ),

    ctaBlock: ({ value }) => {
      const variant = value.variant ?? 'brand'
      return (
        <div
          className={cn(
            'my-8 rounded-2xl p-8 text-center',
            variant === 'brand' && 'bg-brand text-navy-foreground',
            variant === 'navy' && 'bg-navy text-navy-foreground',
            variant === 'subtle' && 'border border-hairline bg-off-white text-navy'
          )}
        >
          <h3 className={cn('text-xl font-bold', variant !== 'subtle' && 'text-navy-foreground')}>
            {value.title}
          </h3>
          {value.description && (
            <p className={cn('mt-2 text-sm', variant !== 'subtle' ? 'text-navy-foreground/80' : 'text-muted-ink')}>
              {value.description}
            </p>
          )}
          <Link
            href={value.buttonUrl ?? '/signup'}
            className={cn(
              'mt-5 inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors',
              variant === 'brand' && 'bg-navy text-navy-foreground hover:bg-navy/90',
              variant === 'navy' && 'bg-brand text-navy-foreground hover:bg-brand/90',
              variant === 'subtle' && 'bg-brand text-navy-foreground hover:bg-navy'
            )}
          >
            {value.buttonText ?? 'Get started free'}
          </Link>
        </div>
      )
    },
  },
}

export function ContentRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="prose-sm max-w-none">
      <PortableText value={blocks} components={components} />
    </div>
  )
}

export function extractHeadings(blocks: ContentBlock[]): { id: string; text: string; level: number }[] {
  return blocks
    .filter((b) => b._type === 'block' && ['h2', 'h3'].includes(b.style))
    .map((b) => ({
      text: b.children?.map((c: { text: string }) => c.text).join('') ?? '',
      id: slugifyHeading(b.children?.map((c: { text: string }) => c.text).join('') ?? ''),
      level: b.style === 'h2' ? 2 : 3,
    }))
}
