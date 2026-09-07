'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { getJson } from '@/lib/api'
import type { CustomerSummary, PageMeta } from '@/lib/admin-types'
import { formatMoney, formatNumber, formatDate } from '@/lib/format'
import { useAsync } from '@/components/admin/use-async'
import {
  ErrorAlert,
  LoadingCard,
  PageHeader,
  Pagination,
  StatusBadge,
  useListQuery
} from '@/components/admin/primitives'
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

type ListResponse = { items: CustomerSummary[]; meta: PageMeta }

export default function CustomersPage() {
  const { page, searchParams, setQuery, setPage } = useListQuery()
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const [searchInput, setSearchInput] = React.useState(q)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status && status !== 'all') params.set('status', status)
  params.set('page', String(page))

  const { data, loading, error } = useAsync<ListResponse>(
    () => getJson(`/admin/customers?${params.toString()}`),
    [q, status, page]
  )

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage customer accounts and view their activity."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault()
            setQuery({ q: searchInput || undefined, page: undefined })
          }}
        >
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name or email…"
            className="w-64 pl-8"
            aria-label="Search customers"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => setQuery({ status: event.target.value, page: undefined })}
          aria-label="Filter by status"
          className="w-40"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
        </Select>
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
                <TableHead>Customer</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="group flex items-center gap-3"
                    >
                      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:underline">
                          {customer.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(customer.orderCount)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(customer.totalSpentMinor)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="user" value={customer.status} />
                  </TableCell>
                </TableRow>
              ))}
              {!data?.items.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No customers found.
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
