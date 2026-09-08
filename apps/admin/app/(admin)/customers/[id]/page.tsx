'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getJson, patchJson } from '@/lib/api'
import type { CustomerDetail } from '@/lib/admin-types'
import { formatMoney, formatNumber, formatDateTime } from '@/lib/format'
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

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const customerId = params.id
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const { data, loading, error, reload } = useAsync<CustomerDetail>(
    () => getJson(`/admin/customers/${customerId}`),
    [customerId]
  )

  const toggleStatus = async () => {
    if (!data) return
    const nextStatus = data.customer.status === 'active' ? 'inactive' : 'active'
    const label = nextStatus === 'active' ? 'Reactivate' : 'Deactivate'
    if (!window.confirm(`${label} this customer?`)) return
    setBusy(true)
    setActionError(null)
    try {
      await patchJson(`/admin/customers/${customerId}/status`, { status: nextStatus })
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingCard />
  if (error || !data) return <ErrorAlert message={error ?? 'Customer not found'} />

  const { customer, orders } = data

  return (
    <>
      <div className="mb-4">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to customers
        </Link>
      </div>

      <PageHeader title={customer.name} description={customer.email}>
        <StatusBadge kind="user" value={customer.status} />
        <Button
          variant={customer.status === 'active' ? 'destructive' : 'outline'}
          onClick={() => void toggleStatus()}
          disabled={busy}
        >
          {customer.status === 'active' ? 'Deactivate' : 'Reactivate'}
        </Button>
      </PageHeader>

      {actionError ? <ErrorAlert message={actionError} className="mb-4" /> : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{customer.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email verified</span>
                <span>{customer.emailVerified ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last login</span>
                <span>{formatDateTime(customer.lastLoginAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{formatDateTime(customer.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total orders</span>
                <span>{formatNumber(orders.meta.totalItems)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Recent orders total</span>
                <span className="text-right font-semibold">
                  {formatMoney(orders.items.reduce((sum, order) => sum + order.totalMinor, 0))}
                </span>
              </div>
              {orders.meta.totalItems > orders.items.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing the latest {orders.items.length} of {orders.meta.totalItems} orders.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved addresses.</p>
              ) : (
                <ul className="space-y-3">
                  {customer.addresses.map((address) => (
                    <li key={address.id} className="rounded-md border p-3 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        {address.label ?? 'Address'}
                        {address.isDefault ? (
                          <span className="text-xs text-muted-foreground">Default</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {address.fullName}
                        <br />
                        {address.line1}
                        {address.line2 ? <>, {address.line2}</> : null}
                        <br />
                        {address.city}
                        {address.state ? `, ${address.state}` : ''} {address.postalCode}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.items.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
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
                {orders.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      This customer has no orders yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
