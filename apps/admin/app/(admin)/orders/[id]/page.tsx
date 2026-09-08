'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getJson, postJson } from '@/lib/api'
import type { OrderDetail } from '@/lib/admin-types'
import { formatMoney, formatDateTime } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader, StatusBadge } from '@/components/admin/primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

// Mirrors ALLOWED_ORDER_TRANSITIONS from @shop/types (cancelled is handled
// as its own destructive action below), so the UI cannot drift from the
// backend state machine.
const FLOW_NEXT: Record<string, string[]> = {
  pending: ['confirmed'],
  confirmed: ['processing'],
  processing: ['packed'],
  packed: ['shipped'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['return_requested', 'refunded'],
  return_requested: ['returned', 'refunded'],
  returned: ['refunded']
}

const CANCELLABLE = new Set([
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'return_requested'
])

const NEXT_LABEL: Record<string, string> = {
  confirmed: 'Confirm order',
  processing: 'Start processing',
  packed: 'Mark as packed',
  shipped: 'Mark as shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Mark as delivered',
  return_requested: 'Request return',
  returned: 'Mark returned',
  refunded: 'Mark refunded'
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const orderId = params.id
  const [busy, setBusy] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const {
    data: order,
    loading,
    error,
    reload
  } = useAsync<OrderDetail>(() => getJson(`/admin/orders/${orderId}`), [orderId])

  const act = async (label: string, action: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(label)
    setActionError(null)
    setNotice(null)
    try {
      await action()
      setNotice(`${label} applied.`)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <LoadingCard />
  if (error || !order) return <ErrorAlert message={error ?? 'Order not found'} />

  const nextActions = FLOW_NEXT[order.status] ?? []
  const nextLabels = nextActions.map((status) => NEXT_LABEL[status] ?? status)
  const canCancel = CANCELLABLE.has(order.status)

  const transition = (status: string, label: string) =>
    act(label, () => postJson(`/admin/orders/${order.id}/transition`, { status }))

  const refundPayment = () =>
    act(
      'Refund payment',
      () => postJson(`/admin/orders/${order.id}/payment`, { paymentStatus: 'refunded' }),
      'Mark this payment as refunded?'
    )

  return (
    <>
      <div className="mb-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
      </div>

      <PageHeader
        title={order.orderNumber}
        description={
          order.customer
            ? `${order.customer.name ?? order.customer.email} · ${formatDateTime(order.createdAt)}`
            : formatDateTime(order.createdAt)
        }
      >
        <StatusBadge kind="order" value={order.status} />
        <StatusBadge kind="payment" value={order.paymentStatus} />
      </PageHeader>

      {notice ? (
        <div className="mb-4 rounded-md border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {actionError ? <ErrorAlert message={actionError} className="mb-4" /> : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {nextActions.map((status, index) => (
          <Button
            key={status}
            disabled={busy !== null}
            onClick={() => void transition(status, nextLabels[index])}
          >
            {nextLabels[index]}
          </Button>
        ))}
        {canCancel ? (
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() =>
              void act(
                'Cancel order',
                () => postJson(`/admin/orders/${order.id}/transition`, { status: 'cancelled' }),
                'Cancel this order and release its reserved stock?'
              )
            }
          >
            Cancel order
          </Button>
        ) : null}
        {order.paymentStatus === 'paid' && !['cancelled', 'refunded'].includes(order.status) ? (
          <Button variant="outline" disabled={busy !== null} onClick={() => void refundPayment()}>
            Refund payment
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="size-10 rounded-md border object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                              {item.optionSummary ? ` · ${item.optionSummary}` : ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(item.unitPriceMinor)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(item.lineTotalMinor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(order.subtotalMinor)}</span>
                </div>
                {order.discountMinor > 0 ? (
                  <div className="flex justify-between text-destructive">
                    <span>Discount ({order.couponCode ?? 'coupon'})</span>
                    <span>−{formatMoney(order.discountMinor)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatMoney(order.shippingMinor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatMoney(order.taxMinor)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(order.totalMinor)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l pl-4">
                {[...order.timeline].reverse().map((event, index) => (
                  <li key={index} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="order" value={event.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.at)}
                      </span>
                    </div>
                    {event.note ? <p className="mt-1 text-sm">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">
                {order.customer?.name ?? order.customer?.email ?? 'Guest'}
              </p>
              {order.customer?.email ? (
                <Link
                  href={`/customers/${order.customer.id}`}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  {order.customer.email}
                </Link>
              ) : null}
              <p className="text-muted-foreground">
                Payment: <StatusBadge kind="payment" value={order.paymentStatus} />
              </p>
              {order.paymentMethod ? (
                <p className="capitalize text-muted-foreground">
                  Method: {order.paymentMethod.replace('_', ' ')}
                </p>
              ) : null}
              {order.shippingMethod?.name ? (
                <p className="text-muted-foreground">
                  Shipping: {order.shippingMethod.name} ({order.shippingMethod.estimatedDays})
                </p>
              ) : null}
              {order.notes ? (
                <p className="mt-2 rounded-md bg-muted p-2 text-muted-foreground">{order.notes}</p>
              ) : null}
            </CardContent>
          </Card>

          {order.shippingAddress ? (
            <Card>
              <CardHeader>
                <CardTitle>Shipping address</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 ? <p>{order.shippingAddress.line2}</p> : null}
                <p>
                  {order.shippingAddress.city}
                  {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.phone ? <p>{order.shippingAddress.phone}</p> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}
