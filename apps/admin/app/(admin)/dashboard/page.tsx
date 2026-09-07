'use client'

import Link from 'next/link'
import { ArrowRight, Banknote, PackageOpen, ShoppingCart, Users } from 'lucide-react'

import { getJson } from '@/lib/api'
import type { DashboardData } from '@/lib/admin-types'
import { formatMoney, formatDate, formatNumber } from '@/lib/format'
import { useAsync } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader, StatusBadge } from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
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

export default function DashboardPage() {
  const { data, loading, error } = useAsync<DashboardData>(() => getJson('/admin/dashboard'), [])

  if (loading) return <LoadingCard />
  if (error || !data) return <ErrorAlert message={error ?? 'Unable to load dashboard'} />

  const { counts } = data
  const maxRevenue = Math.max(...data.revenueSeries.map((point) => point.revenueMinor), 1)

  const statCards = [
    {
      label: 'Revenue',
      value: formatMoney(counts.revenueMinor),
      sub: `${formatNumber(counts.orders)} orders`,
      icon: Banknote
    },
    {
      label: 'Customers',
      value: formatNumber(counts.customers),
      sub: `${formatNumber(counts.customersNew30d)} new in 30d`,
      icon: Users
    },
    {
      label: 'Products',
      value: formatNumber(counts.products),
      sub: `${formatNumber(counts.productsPublished)} published`,
      icon: PackageOpen
    },
    {
      label: 'Reviews pending',
      value: formatNumber(counts.reviewsPending),
      sub: `${formatNumber(counts.couponsActive)} coupons active`,
      icon: ShoppingCart
    }
  ]

  return (
    <>
      <PageHeader title="Dashboard" description="A live overview of store performance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Revenue — last 14 days</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports">
                Reports <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-1.5">
              {data.revenueSeries.map((point) => {
                const height = point.revenueMinor > 0 ? (point.revenueMinor / maxRevenue) * 100 : 2
                return (
                  <div
                    key={point.date}
                    className="group relative flex flex-1 flex-col justify-end"
                    title={`${formatDate(point.date)}: ${formatMoney(point.revenueMinor)}`}
                  >
                    <div
                      className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ordersByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              data.ordersByStatus.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <StatusBadge kind="order" value={row.status} />
                  <span className="text-sm font-semibold">{formatNumber(row.count)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recent orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customer.name ?? order.customer.email ?? '—'}</TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(order.totalMinor)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="order" value={order.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {data.recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Top products (30d)</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/reports">
                  Details <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center gap-3">
                  <span className="w-5 text-right text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(product.units)} units
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(product.revenueMinor)}</span>
                </div>
              ))}
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales in the last 30 days.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.id}`}
                      className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <Badge variant={item.available <= 0 ? 'destructive' : 'warning'}>
                    {item.available} left
                  </Badge>
                </div>
              ))}
              {data.lowStockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All products have healthy stock levels.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
