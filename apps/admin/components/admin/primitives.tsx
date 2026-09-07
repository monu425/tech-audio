'use client'

import * as React from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const STATUS_STYLES: Record<string, Record<string, BadgeVariant>> = {
  order: {
    pending: 'warning',
    confirmed: 'secondary',
    processing: 'secondary',
    packed: 'secondary',
    shipped: 'outline',
    out_for_delivery: 'warning',
    delivered: 'success',
    cancelled: 'destructive',
    return_requested: 'warning',
    returned: 'destructive',
    refunded: 'default'
  },
  payment: {
    pending: 'warning',
    paid: 'success',
    failed: 'destructive',
    refunded: 'outline',
    partially_refunded: 'warning'
  },
  product: {
    draft: 'warning',
    published: 'success',
    archived: 'secondary'
  },
  user: {
    active: 'success',
    inactive: 'secondary',
    locked: 'destructive'
  },
  review: {
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive'
  },
  coupon: {
    active: 'success',
    inactive: 'secondary',
    expired: 'destructive'
  },
  stock: {
    in_stock: 'success',
    low_stock: 'warning',
    out_of_stock: 'destructive'
  }
}

const DEFAULT_LABELS: Record<string, Record<string, string>> = {
  order: { out_for_delivery: 'Out for delivery', return_requested: 'Return requested' },
  product: {},
  user: {},
  review: {},
  coupon: {},
  payment: { partially_refunded: 'Partial refund' }
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function StatusBadge({
  kind,
  value,
  className
}: {
  kind: keyof typeof STATUS_STYLES
  value: string | null | undefined
  className?: string
}) {
  const safe = value ?? ''
  const variant = STATUS_STYLES[kind]?.[safe] ?? 'secondary'
  const label = DEFAULT_LABELS[kind]?.[safe] ?? humanize(safe)
  return (
    <Badge variant={variant} className={className}>
      {label || '—'}
    </Badge>
  )
}

export function PageHeader({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function ErrorAlert({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className
      )}
      role="alert"
    >
      {message}
    </div>
  )
}

export function LoadingCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </CardContent>
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action}
      </CardContent>
    </Card>
  )
}

export function Pagination({
  page,
  totalPages,
  onChange
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const visible = pages.filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1
  )
  const items: (number | 'ellipsis')[] = []
  let last = 0
  for (const item of visible) {
    if (item - last > 1) items.push('ellipsis')
    items.push(item)
    last = item
  }
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'default' : 'ghost'}
              size="icon"
              className="text-xs"
              onClick={() => onChange(item)}
            >
              {item}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

export function useListQuery(defaultPage = 1) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page') ?? defaultPage) || 1)

  const setQuery = React.useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || value === 'all') {
          params.delete(key)
        } else {
          params.set(key, String(value))
        }
      }
      const text = params.toString()
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const setPage = React.useCallback(
    (next: number) => setQuery({ page: next > 1 ? next : undefined }),
    [setQuery]
  )

  return { page, searchParams, setQuery, setPage }
}
