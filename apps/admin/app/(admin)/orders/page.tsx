'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { getJson } from '@/lib/api'
import type { OrderSummary, PageMeta } from '@/lib/admin-types'
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

type ListResponse = { items: OrderSummary[]; meta: PageMeta }

export default function OrdersPage() {
  const { page, searchParams, setQuery, setPage } = useListQuery()
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const paymentStatus = searchParams.get('paymentStatus') ?? 'all'
  const [searchInput, setSearchInput] = React.useState(q)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status && status !== 'all') params.set('status', status)
  if (paymentStatus && paymentStatus !== 'all') params.set('paymentStatus', paymentStatus)
  params.set('page', String(page))

  const { data, loading, error } = useAsync<ListResponse>(
    () => getJson(`/admin/orders?${params.toString()}`),
    [q, status, paymentStatus, page]
  )

  const commitSearch = (value: string) => setQuery({ q: value || undefined, page: undefined })

  return (
    <>
      <PageHeader title="Orders" description="Review and update customer orders." />

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
            placeholder="Search order #, customer…"
            className="w-64 pl-8"
            aria-label="Search orders"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => setQuery({ status: event.target.value, page: undefined })}
          aria-label="Filter by status"
          className="w-44"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="packed">Packed</option>
          <option value="shipped">Shipped</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="return_requested">Return requested</option>
          <option value="returned">Returned</option>
          <option value="refunded">Refunded</option>
        </Select>
        <Select
          value={paymentStatus}
          onChange={(event) => setQuery({ paymentStatus: event.target.value, page: undefined })}
          aria-label="Filter by payment"
          className="w-44"
        >
          <option value="all">All payments</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially refunded</option>
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
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate">{order.customer.name ?? 'Guest'}</p>
                      {order.customer.email ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {order.customer.email}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">{order.itemsCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(order.totalMinor)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="order" value={order.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="payment" value={order.paymentStatus} />
                  </TableCell>
                </TableRow>
              ))}
              {!data?.items.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No orders match your filters.
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
