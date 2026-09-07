'use client'

import { useEffect, useState } from 'react'
import { PackageCheck, PackageSearch } from 'lucide-react'
import Link from 'next/link'

import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson } from '@/lib/api'
import { formatMoney, formatDate } from '@/lib/format'
import type { OrderDetail } from '@/lib/store-types'

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered']

export function OrderDetailView({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getJson<OrderDetail>(`/orders/${id}`)
      .then(setOrder)
      .catch(() => setError('Unable to load this order.'))
  }, [id])

  if (error) {
    return (
      <AccountShell active="/account/orders" title="Order">
        <div className="rounded-xl border py-16 text-center">
          <PackageSearch className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3">{error}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/account/orders">Back to orders</Link>
          </Button>
        </div>
      </AccountShell>
    )
  }

  if (!order) {
    return (
      <AccountShell active="/account/orders" title="Order">
        <Skeleton className="h-32 w-full" />
      </AccountShell>
    )
  }

  const currentStep = STATUS_STEPS.indexOf(order.status)

  return (
    <AccountShell active="/account/orders" title={`Order ${order.orderNumber}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.createdAt)} · {order.itemsCount} item
            {order.itemsCount === 1 ? '' : 's'}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/account/orders">Back to orders</Link>
          </Button>
        </div>

        {order.status !== 'cancelled' ? (
          <ol className="grid grid-cols-2 gap-2 rounded-xl border p-4 sm:grid-cols-4">
            {STATUS_STEPS.map((status, index) => (
              <li key={status} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    index <= currentStep
                      ? 'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
                      : 'flex size-6 items-center justify-center rounded-full border text-muted-foreground'
                  }
                >
                  {index < currentStep ? '✓' : index + 1}
                </span>
                <span className={index <= currentStep ? 'font-medium' : 'text-muted-foreground'}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            This order was cancelled.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="size-4" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {order.items.map((item, index) => (
                    <li key={index} className="flex items-center gap-4 py-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-14 w-12 rounded border object-cover"
                        />
                      ) : (
                        <div className="h-14 w-12 rounded border bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.slug}`}
                          className="line-clamp-1 text-sm font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                        {item.optionSummary ? (
                          <p className="text-xs text-muted-foreground">{item.optionSummary}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(item.unitPriceMinor, order.currency)} × {item.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.lineTotalMinor, order.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">
                      {formatMoney(order.subtotalMinor, order.currency)}
                    </dd>
                  </div>
                  {order.discountMinor > 0 ? (
                    <div className="flex justify-between text-emerald-600">
                      <dt>Discount {order.couponCode ? `(${order.couponCode})` : ''}</dt>
                      <dd className="tabular-nums">
                        -{formatMoney(order.discountMinor, order.currency)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="tabular-nums">
                      {order.shippingMinor
                        ? formatMoney(order.shippingMinor, order.currency)
                        : 'Free'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd className="tabular-nums">{formatMoney(order.taxMinor, order.currency)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">
                      {formatMoney(order.totalMinor, order.currency)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                  <p>
                    Payment: {order.paymentMethod.toUpperCase()} · {order.paymentStatus}
                  </p>
                  {order.shippingMethod ? <p>Shipping: {order.shippingMethod.name}</p> : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shipping address</CardTitle>
              </CardHeader>
              <CardContent>
                <address className="text-sm not-italic text-muted-foreground">
                  <div className="font-medium text-foreground">
                    {order.shippingAddress.fullName}
                  </div>
                  <div>{order.shippingAddress.line1}</div>
                  {order.shippingAddress.line2 ? <div>{order.shippingAddress.line2}</div> : null}
                  <div>
                    {order.shippingAddress.city}
                    {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''}{' '}
                    {order.shippingAddress.postalCode}
                  </div>
                  <div>{order.shippingAddress.country}</div>
                  {order.shippingAddress.phone ? <div>{order.shippingAddress.phone}</div> : null}
                </address>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AccountShell>
  )
}
