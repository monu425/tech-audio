'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'

import { getJson, postJson } from '@/lib/api'
import type { Coupon, PageMeta } from '@/lib/admin-types'
import { formatMoney, formatDate } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import {
  ErrorAlert,
  LoadingCard,
  PageHeader,
  StatusBadge,
  useListQuery
} from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ListResponse = { items: Coupon[]; meta: PageMeta }

type FormState = {
  code: string
  type: string
  value: string
  minSubtotal: string
  maxDiscount: string
  usageLimit: string
  perUserLimit: string
  expiresAt: string
  enabled: boolean
}

const EMPTY_FORM: FormState = {
  code: '',
  type: 'percentage',
  value: '',
  minSubtotal: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '',
  expiresAt: '',
  enabled: true
}

export default function CouponsPage() {
  const { searchParams, setQuery, page } = useListQuery()
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('statusFilter') ?? 'all'

  const { data, loading, error, reload } = useAsync<ListResponse>(
    () =>
      getJson(
        `/admin/coupons?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}${status !== 'all' ? `&statusFilter=${status}` : ''}`
      ),
    [q, status, page]
  )

  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setActionError(null)
    setCreateOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      const body: Record<string, unknown> = {
        code: form.code,
        type: form.type,
        value: Math.round((Number(form.value) || 0) * (form.type === 'percentage' ? 1 : 100)),
        minSubtotalMinor: Math.round((Number(form.minSubtotal) || 0) * 100),
        enabled: form.enabled
      }
      if (form.maxDiscount) body.maxDiscountMinor = Math.round(Number(form.maxDiscount) * 100)
      if (form.usageLimit) body.usageLimit = Math.round(Number(form.usageLimit))
      if (form.perUserLimit) body.perUserLimit = Math.round(Number(form.perUserLimit))
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString()
      await postJson('/admin/coupons', body)
      setCreateOpen(false)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (coupon: Coupon) => {
    try {
      await postJson(`/admin/coupons/${coupon.id}/toggle`)
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  const statusCounts = data?.meta.statusCounts

  return (
    <>
      <PageHeader title="Coupons" description="Promotion codes customers apply at checkout.">
        <Button onClick={openCreate}>
          <Plus /> New coupon
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(event) => setQuery({ statusFilter: event.target.value, page: undefined })}
          aria-label="Filter coupons"
          className="w-44"
        >
          <option value="all">All coupons</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired / exhausted</option>
        </Select>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {statusCounts
            ? Object.entries(statusCounts)
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
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono text-xs font-semibold">{coupon.code}</TableCell>
                    <TableCell>
                      {coupon.type === 'percentage'
                        ? `${coupon.value}% off`
                        : `${formatMoney(coupon.value)} off`}
                      {coupon.minSubtotalMinor > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          min {formatMoney(coupon.minSubtotalMinor)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                      {coupon.perUserLimit ? (
                        <p className="text-xs text-muted-foreground">
                          {coupon.perUserLimit} per customer
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(coupon.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="coupon" value={coupon.statusLabel} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void toggle(coupon)}
                        disabled={coupon.statusLabel === 'expired'}
                      >
                        {coupon.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.items.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No coupons found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New coupon"
        description="Create a discount code customers can use at checkout."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="coupon-form" disabled={busy}>
              {busy ? 'Creating…' : 'Create coupon'}
            </Button>
          </>
        }
      >
        <form id="coupon-form" onSubmit={submit} className="space-y-4">
          {actionError ? <ErrorAlert message={actionError} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="SAVE10"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                id="type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value }))
                }
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="value">
                {form.type === 'percentage' ? 'Percent off *' : 'Amount off (USD) *'}
              </Label>
              <Input
                id="value"
                type="number"
                min="0"
                step={form.type === 'percentage' ? '1' : '0.01'}
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({ ...current, value: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minSubtotal">Minimum subtotal (USD)</Label>
              <Input
                id="minSubtotal"
                type="number"
                min="0"
                step="0.01"
                value={form.minSubtotal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, minSubtotal: event.target.value }))
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="usageLimit">Total usage limit</Label>
              <Input
                id="usageLimit"
                type="number"
                min="1"
                step="1"
                value={form.usageLimit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, usageLimit: event.target.value }))
                }
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="perUserLimit">Uses per customer</Label>
              <Input
                id="perUserLimit"
                type="number"
                min="1"
                step="1"
                value={form.perUserLimit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, perUserLimit: event.target.value }))
                }
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiresAt">Expires at</Label>
            <Input
              id="expiresAt"
              type="date"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiresAt: event.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                setForm((current) => ({ ...current, enabled: event.target.checked }))
              }
              className="size-4 rounded border-input"
            />
            Active immediately
          </label>
        </form>
      </Dialog>
    </>
  )
}
