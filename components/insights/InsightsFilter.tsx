'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { SanityCategory } from '@/sanity/lib/types'
import { cn } from '@/lib/utils'

interface InsightsFilterProps {
  categories: SanityCategory[]
}

export function InsightsFilter({ categories }: InsightsFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentCategory = searchParams.get('category') ?? ''
  const currentSearch = searchParams.get('q') ?? ''

  const [searchValue, setSearchValue] = useState(currentSearch)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setSearchValue(currentSearch)
  }, [currentSearch])

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      updateUrl({ q: value || null })
    }, 400)
  }

  function handleCategoryClick(slug: string) {
    updateUrl({ category: slug === currentCategory ? null : slug })
  }

  const hasFilters = currentCategory || currentSearch

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-ink/50 pointer-events-none" />
        <input
          type="text"
          placeholder="Search insights…"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full rounded-xl border border-hairline bg-white pl-9 pr-9 py-2.5 text-sm text-navy placeholder:text-muted-ink/50 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-colors"
        />
        {searchValue && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink/50 hover:text-muted-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryClick('')}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
              !currentCategory
                ? 'bg-navy text-navy-foreground shadow-sm'
                : 'border border-hairline bg-white text-muted-ink hover:border-brand/30 hover:text-navy'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryClick(cat.slug)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                currentCategory === cat.slug
                  ? 'bg-brand text-navy-foreground shadow-sm'
                  : 'border border-hairline bg-white text-muted-ink hover:border-brand/30 hover:text-navy'
              )}
            >
              {cat.title}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => {
                setSearchValue('')
                updateUrl({ category: null, q: null })
              }}
              className="flex items-center gap-1 rounded-full border border-hairline bg-white px-3.5 py-1.5 text-xs font-medium text-muted-ink hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
