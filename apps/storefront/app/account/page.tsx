'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Mail } from 'lucide-react'
import Link from 'next/link'

import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getJson } from '@/lib/api'
import { formatMoney, formatDate } from '@/lib/format'
import type { OrderSummary } from '@/lib/store-types'

export default function AccountOverviewPage() {
  const [user, setUser] = useState<{
    id: string
    name: string
    email: string
    emailVerified: boolean
  } | null>(null)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [ordersMeta, setOrdersMeta] = useState({ totalItems: 0 })

  useEffect(() => {
    getJson<{ user: typeof user }>('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => undefined)
    getJson<{ items: OrderSummary[]; meta: typeof ordersMeta }>('/orders?pageSize=5')
      .then((data) => {
        setOrders(data.items)
        setOrdersMeta(data.meta)
      })
      .catch(() => undefined)
  }, [])

  return (
    <AccountShell active="/account" title="My account">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-base font-semibold">
              {user?.name ?? '…'}
              {user?.emailVerified ? (
                <BadgeCheck className="size-4 text-emerald-600" aria-label="Verified email" />
              ) : null}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              {user?.email ?? '…'}
            </p>
            {user && !user.emailVerified ? (
              <p className="text-xs text-amber-600">Your email is not verified yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{ordersMeta.totalItems}</p>
            <p className="text-sm text-muted-foreground">orders placed</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/account/orders">
                View all orders <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {orders.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)} · {order.itemsCount} item
                      {order.itemsCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold tabular-nums">
                      {formatMoney(order.totalMinor, order.currency)}
                    </span>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </AccountShell>
  )
}
