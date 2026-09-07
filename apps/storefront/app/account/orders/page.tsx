'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson } from '@/lib/api'
import { formatMoney, formatDate } from '@/lib/format'
import type { OrderSummary } from '@/lib/store-types'

const ORDER_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [meta, setMeta] = useState<{ page: number; totalPages: number; totalItems: number } | null>(
    null
  )
  const [page, setPage] = useState(1)

  useEffect(() => {
    getJson<{ items: OrderSummary[]; meta: typeof meta }>(`/orders?page=${page}&pageSize=10`)
      .then((data) => {
        setOrders(data.items)
        setMeta(data.meta)
      })
      .catch(() => {
        setOrders([])
        setMeta({ page: 1, totalPages: 1, totalItems: 0 })
      })
  }, [page])

  return (
    <AccountShell active="/account/orders" title="Orders">
      {orders === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border py-16 text-center">
          <p className="text-lg font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When you place an order it will appear here.
          </p>
          <Button asChild className="mt-6">
            <Link href="/products">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/40"
                >
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Placed {formatDate(order.createdAt)} · {order.itemsCount} item
                      {order.itemsCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm font-medium text-muted-foreground">
                      {ORDER_LABELS[order.status] ?? order.status}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(order.totalMinor, order.currency)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {meta && meta.totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </AccountShell>
  )
}
