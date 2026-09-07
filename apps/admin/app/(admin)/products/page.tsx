'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'

import { getJson } from '@/lib/api'
import type { PageMeta, ProductListItem } from '@/lib/admin-types'
import { formatMoney, formatDate } from '@/lib/format'
import { useAsync } from '@/components/admin/use-async'
import {
  ErrorAlert,
  LoadingCard,
  PageHeader,
  Pagination,
  StatusBadge,
  useListQuery
} from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ListResponse = {
  items: ProductListItem[]
  meta: PageMeta
}

export default function ProductsPage() {
  const { page, searchParams, setQuery, setPage } = useListQuery()
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const stockFilter = searchParams.get('stockFilter') ?? 'all'
  const [searchInput, setSearchInput] = React.useState(q)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status && status !== 'all') params.set('status', status)
  if (stockFilter && stockFilter !== 'all') params.set('stockFilter', stockFilter)
  params.set('page', String(page))

  const { data, loading, error } = useAsync<ListResponse>(
    () => getJson(`/admin/products?${params.toString()}`),
    [q, status, stockFilter, page]
  )

  const commitSearch = (value: string) => {
    setQuery({ q: value || undefined, page: undefined })
  }

  return (
    <>
      <PageHeader title="Products" description="Create, edit and organize your catalog.">
        <Button asChild>
          <Link href="/products/new">
            <Plus /> New product
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault()
            commitSearch(searchInput)
          }}
        >
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name or SKU…"
            className="w-64 pl-8"
            aria-label="Search products"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => setQuery({ status: event.target.value, page: undefined })}
          aria-label="Filter by status"
          className="w-40"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
        <Select
          value={stockFilter}
          onChange={(event) => setQuery({ stockFilter: event.target.value, page: undefined })}
          aria-label="Filter by stock"
          className="w-40"
        >
          <option value="all">Any stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </Select>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {data?.meta.statusCounts
            ? Object.entries(data.meta.statusCounts)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <Badge key={key} variant="secondary">
                    {key}: {count}
                  </Badge>
                ))
            : null}
        </div>
      </div>

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link href={`/products/${product.id}`} className="flex items-center gap-3">
                      {product.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0].url}
                          alt=""
                          className="size-10 rounded-md border object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate font-medium underline-offset-4 hover:underline">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku}
                          {product.variants.length > 0
                            ? ` · ${product.variants.length} variants`
                            : ''}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{product.category?.name ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(product.priceMinor, product.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        product.availableStock <= 0
                          ? 'font-medium text-destructive'
                          : product.availableStock <= product.lowStockThreshold
                            ? 'font-medium text-amber-600'
                            : 'font-medium text-emerald-600'
                      }
                    >
                      {product.availableStock}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge kind="product" value={product.status} />
                      {product.featured ? <Badge variant="outline">Featured</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(product.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.items.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No products match your filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
        </>
      )}
    </>
  )
}
