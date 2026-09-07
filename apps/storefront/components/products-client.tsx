'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListFilter, SlidersHorizontal, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ProductCard } from '@/components/product-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CatalogListData } from '@/lib/store-types'

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'newest', label: 'Newest' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'rating', label: 'Top rated' }
]

interface ViewState {
  data: CatalogListData | null
  error: boolean
}

export function ProductsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const query = useMemo(() => {
    const q = searchParams.get('q') ?? ''
    const category = searchParams.get('category') ?? ''
    const brands = (searchParams.get('brand') ?? '').split(',').filter(Boolean)
    const sort = searchParams.get('sort') ?? 'relevance'
    const onSale = searchParams.get('onSale') === 'true'
    const inStock = searchParams.get('inStock') === 'true'
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1
    return { q, category, brands, sort, onSale, inStock, page }
  }, [searchParams])

  const [state, setState] = useState<ViewState>({ data: null, error: false })
  const [reloadKey, setReloadKey] = useState(0)
  const [showFilters, setShowFilters] = useState(false)

  const buildParams = useCallback(
    (patch: Partial<typeof query>) => {
      const next = new URLSearchParams()
      const merged = { ...query, ...patch }
      if (merged.q) next.set('q', merged.q)
      if (merged.category) next.set('category', merged.category)
      if (merged.brands.length) next.set('brand', merged.brands.join(','))
      if (merged.sort && merged.sort !== 'relevance') next.set('sort', merged.sort)
      if (merged.onSale) next.set('onSale', 'true')
      if (merged.inStock) next.set('inStock', 'true')
      if (merged.page > 1) next.set('page', String(merged.page))
      const qs = next.toString()
      router.push(qs ? `/products?${qs}` : '/products', { scroll: true })
    },
    [query, router]
  )

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    if (query.category) params.set('category', query.category)
    if (query.brands.length) params.set('brand', query.brands.join(','))
    params.set('sort', query.sort)
    if (query.onSale) params.set('onSale', 'true')
    if (query.inStock) params.set('inStock', 'true')
    params.set('page', String(query.page))
    params.set('pageSize', '24')
    return `/catalog/products?${params.toString()}`
  }, [query])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    getJson<CatalogListData>(url, controller.signal)
      .then((data) => {
        if (active) setState({ data, error: false })
      })
      .catch((error) => {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setState((current) => ({ ...current, error: true }))
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [url, reloadKey])

  const data = state.data
  const meta = data?.meta
  const facets = data?.facets
  const totalPages = meta?.totalPages ?? 1
  const hasActiveFilters = Boolean(
    query.q || query.category || query.brands.length || query.onSale || query.inStock
  )

  function toggleBrand(slug: string) {
    const brands = query.brands.includes(slug)
      ? query.brands.filter((item) => item !== slug)
      : [...query.brands, slug]
    buildParams({ brands, page: 1 })
  }

  function clearFilters() {
    buildParams({ q: '', category: '', brands: [], onSale: false, inStock: false, page: 1 })
  }

  const pageStart = data?.meta ? (data.meta.page - 1) * data.meta.pageSize + 1 : 0
  const pageEnd = data?.meta
    ? Math.min(data.meta.page * data.meta.pageSize, data.meta.totalItems)
    : 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {query.q
              ? `Results for “${query.q}”`
              : query.category
                ? query.category.replace(/-/g, ' ')
                : 'All products'}
          </h1>
          {data?.meta ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {meta?.totalItems} product{meta && meta.totalItems === 1 ? '' : 's'}
              {meta && pageStart > 0 && meta.totalItems > 0
                ? ` · showing ${pageStart}–${pageEnd}`
                : ''}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowFilters((open) => !open)}
          >
            <SlidersHorizontal className="size-4" />
            Filters
          </Button>
          <select
            aria-label="Sort products"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={query.sort}
            onChange={(event) => buildParams({ sort: event.target.value, page: 1 })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          {query.q ? (
            <span className="rounded-full border bg-muted px-3 py-1">“{query.q}”</span>
          ) : null}
          {query.category ? (
            <span className="rounded-full border bg-muted px-3 py-1">{query.category}</span>
          ) : null}
          {query.brands.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => toggleBrand(brand)}
              className="rounded-full border bg-muted px-3 py-1 hover:bg-accent"
            >
              {brand} <X className="inline size-3" />
            </button>
          ))}
          {query.onSale ? (
            <span className="rounded-full border bg-muted px-3 py-1">On sale</span>
          ) : null}
          {query.inStock ? (
            <span className="rounded-full border bg-muted px-3 py-1">In stock</span>
          ) : null}
          <button onClick={clearFilters} className="font-medium text-primary hover:underline">
            Clear all
          </button>
        </div>
      ) : null}

      <div className="flex gap-8">
        <aside
          className={cn(
            'w-60 shrink-0 space-y-6',
            showFilters
              ? 'fixed inset-x-0 bottom-0 top-0 z-30 overflow-y-auto border-r bg-background p-5 lg:static lg:z-auto lg:border-0 lg:p-0'
              : 'hidden lg:block'
          )}
        >
          {showFilters ? (
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <span className="font-semibold">Filters</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}

          {facets?.categories?.length ? (
            <FilterSection title="Category">
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => buildParams({ category: '', page: 1 })}
                    className={cn(
                      'hover:underline',
                      !query.category ? 'font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    All categories
                  </button>
                </li>
                {facets.categories.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => buildParams({ category: item.slug, page: 1 })}
                      className={cn(
                        'flex w-full justify-between gap-2 hover:underline',
                        query.category === item.slug ? 'font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      <span className="capitalize">{item.name}</span>
                      <span className="tabular-nums opacity-70">{item.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </FilterSection>
          ) : null}

          {facets?.brands?.length ? (
            <FilterSection title="Brand">
              <ul className="space-y-2 text-sm">
                {facets.brands.map((item) => (
                  <li key={item.slug}>
                    <label className="flex cursor-pointer items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={query.brands.includes(item.slug)}
                          onChange={() => toggleBrand(item.slug)}
                        />
                        <span
                          className={cn(
                            !query.brands.includes(item.slug) && 'text-muted-foreground'
                          )}
                        >
                          {item.name}
                        </span>
                      </span>
                      <span className="tabular-nums text-xs opacity-70">{item.count}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </FilterSection>
          ) : null}

          <FilterSection title="Availability">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={query.inStock}
                onChange={() => buildParams({ inStock: !query.inStock, page: 1 })}
              />
              In stock
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={query.onSale}
                onChange={() => buildParams({ onSale: !query.onSale, page: 1 })}
              />
              On sale
            </label>
          </FilterSection>
        </aside>

        <div className="min-w-0 flex-1">
          {!data && state.error ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="text-lg font-medium">Could not load products</p>
              <p className="text-sm text-muted-foreground">
                Something went wrong while reaching the catalogue. Please try again.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setState({ data: null, error: false })
                  setReloadKey((key) => key + 1)
                }}
              >
                Retry
              </Button>
            </div>
          ) : !data ? (
            <ProductGridSkeleton />
          ) : !data.items.length ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <ListFilter className="size-8 text-muted-foreground" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search terms.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav
                  className="mt-10 flex items-center justify-center gap-1"
                  aria-label="Pagination"
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={query.page <= 1}
                    onClick={() => buildParams({ page: query.page - 1 })}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      variant={pageNumber === query.page ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => buildParams({ page: pageNumber })}
                      aria-current={pageNumber === query.page ? 'page' : undefined}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={query.page >= totalPages}
                    onClick={() => buildParams({ page: query.page + 1 })}
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}
