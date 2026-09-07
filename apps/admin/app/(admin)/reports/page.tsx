'use client'

import * as React from 'react'

import { getJson } from '@/lib/api'
import type { SalesReport, TopProductsReport } from '@/lib/admin-types'
import { formatMoney, formatNumber } from '@/lib/format'
import { useAsync } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader } from '@/components/admin/primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type Range = '7' | '30' | '90'

export default function ReportsPage() {
  const [range, setRange] = React.useState<Range>('30')

  const sales = useAsync<SalesReport>(() => {
    const from = new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10)
    return getJson(`/admin/reports/sales?from=${from}&groupBy=day`)
  }, [range])

  const topProducts = useAsync<TopProductsReport>(() => {
    const from = new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10)
    return getJson(`/admin/reports/top-products?from=${from}&limit=10`)
  }, [range])

  const report = sales.data
  const maxRevenue = Math.max(...(report?.series.map((point) => point.revenueMinor) ?? []), 1)

  return (
    <>
      <PageHeader title="Reports" description="Sales analytics for the selected period.">
        <Select
          value={range}
          onChange={(event) => setRange(event.target.value as Range)}
          aria-label="Report period"
          className="w-36"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </PageHeader>

      {sales.loading || !report ? (
        <LoadingCard />
      ) : sales.error ? (
        <ErrorAlert message={sales.error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Revenue', value: formatMoney(report.summary.revenueMinor) },
              { label: 'Orders', value: formatNumber(report.summary.orders) },
              {
                label: 'Average order',
                value: formatMoney(report.summary.avgOrderMinor)
              },
              {
                label: 'Units sold',
                value: formatNumber(report.summary.itemsSold)
              }
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Revenue over time</CardTitle>
              {report.summary.revenueChangePercent !== null ? (
                <span
                  className={
                    report.summary.revenueChangePercent >= 0
                      ? 'text-sm font-medium text-emerald-600'
                      : 'text-sm font-medium text-destructive'
                  }
                >
                  {report.summary.revenueChangePercent >= 0 ? '+' : ''}
                  {report.summary.revenueChangePercent}% vs previous period
                </span>
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-1">
                {report.series.map((point) => {
                  const height =
                    point.revenueMinor > 0 ? (point.revenueMinor / maxRevenue) * 100 : 1.5
                  return (
                    <div
                      key={point.key}
                      className="group relative flex flex-1 flex-col justify-end"
                      title={`${point.label}: ${formatMoney(point.revenueMinor)} · ${point.orders} orders`}
                    >
                      <div
                        className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                        style={{ height: `${Math.max(height, 1.5)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{report.series[0]?.label ?? ''}</span>
                <span>{report.series[report.series.length - 1]?.label ?? ''}</span>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : topProducts.error ? (
                  <ErrorAlert message={topProducts.error} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.data?.items.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="size-9 rounded-md border object-cover"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <p className="truncate font-medium">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.sharePercent}% of units
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(item.units)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(item.revenueMinor)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!topProducts.data?.items.length ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No sales in this period.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Period totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Top products revenue</span>
                  <span className="font-semibold">
                    {formatMoney(topProducts.data?.meta.revenueMinor ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Total revenue</span>
                  <span className="font-semibold">{formatMoney(report.summary.revenueMinor)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Total orders</span>
                  <span className="font-semibold">{formatNumber(report.summary.orders)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Orders today</span>
                  <span className="font-semibold">
                    {formatNumber(report.summary.lastDayOrders)}
                  </span>
                </div>
                <Button asChild variant="outline" className="w-full" onClick={() => sales.reload()}>
                  <span>Refresh</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
