'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, RotateCcw } from 'lucide-react'

import { getJson, postJson } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader } from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type InventoryResponse = {
  product: { id: string; name: string; sku: string; hasVariants: boolean }
  rows: {
    id: string | null
    variantId: string | null
    label: string
    sku: string
    stock: number
    reserved: number
    available: number
  }[]
  movements: {
    id: string
    change: number
    reason: string
    note: string | null
    referenceType: string
    referenceId: string | null
    sku: string | null
    actorName: string | null
    createdAt: string
  }[]
}

type AdjustForm = {
  variantId: string
  delta: string
  reason: string
  note: string
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    manual_adjustment: 'Manual adjustment',
    restock: 'Restock',
    return: 'Return',
    order_placed: 'Order placed',
    order_cancelled: 'Order cancelled'
  }
  return labels[reason] ?? reason.replace(/_/g, ' ')
}

export default function ProductInventoryPage() {
  const params = useParams<{ id: string }>()
  const productId = params.id
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [adjustRow, setAdjustRow] = React.useState<InventoryResponse['rows'][number] | null>(null)
  const [form, setForm] = React.useState<AdjustForm>({
    variantId: '',
    delta: '',
    reason: 'manual_adjustment',
    note: ''
  })
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const { data, loading, error, reload } = useAsync<InventoryResponse>(
    () => getJson(`/admin/products/${productId}/inventory`),
    [productId]
  )

  const openAdjust = (row: InventoryResponse['rows'][number]) => {
    setAdjustRow(row)
    setForm({
      variantId: row.variantId ?? '',
      delta: '',
      reason: 'manual_adjustment',
      note: ''
    })
    setActionError(null)
    setDialogOpen(true)
  }

  const submitAdjust = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      const delta = Number.parseInt(form.delta, 10)
      if (!Number.isFinite(delta) || delta === 0) {
        throw new Error('Enter a non-zero whole number of units.')
      }
      await postJson(`/admin/products/${productId}/inventory/adjust`, {
        variantId: form.variantId || null,
        delta,
        reason: form.reason,
        note: form.note.trim() || undefined
      })
      setDialogOpen(false)
      setNotice(
        delta > 0
          ? `Added ${delta} units to ${adjustRow?.label ?? 'Default'}.`
          : `Removed ${Math.abs(delta)} units from ${adjustRow?.label ?? 'Default'}.`
      )
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingCard />
  if (error || !data) return <ErrorAlert message={error ?? 'Inventory unavailable'} />

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/products/${productId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {data.product.name}
        </Link>
      </div>

      <PageHeader title="Inventory" description={`${data.product.name} · ${data.product.sku}`} />

      {notice ? (
        <div className="mb-4 rounded-md border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Stock levels</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => reload()}>
            <RotateCcw /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.variantId ?? 'base'}>
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">{row.stock}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.reserved}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.available <= 0 ? 'destructive' : 'secondary'}>
                      {row.available}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openAdjust(row)}>
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(movement.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{movement.sku ?? '—'}</TableCell>
                  <TableCell
                    className={
                      movement.change >= 0
                        ? 'text-right font-medium text-emerald-600'
                        : 'text-right font-medium text-destructive'
                    }
                  >
                    {movement.change >= 0 ? '+' : ''}
                    {movement.change}
                  </TableCell>
                  <TableCell>{reasonLabel(movement.reason)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {movement.referenceType === 'order'
                      ? `Order ${movement.referenceId ?? ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {movement.note ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {data.movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No stock movements recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={`Adjust stock — ${adjustRow?.label ?? 'Default'}`}
        description={`Current stock: ${adjustRow?.stock ?? 0}, reserved: ${adjustRow?.reserved ?? 0}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitAdjust}
              disabled={busy}
              type="submit"
              form="adjust-form"
            >
              {busy ? 'Saving…' : 'Apply adjustment'}
            </Button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={submitAdjust} className="space-y-4">
          {actionError ? <ErrorAlert message={actionError} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="delta">Units (use − to remove)</Label>
              <Input
                id="delta"
                type="number"
                required
                value={form.delta}
                onChange={(event) =>
                  setForm((current) => ({ ...current, delta: event.target.value }))
                }
                placeholder="e.g. +10 or -2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Select
                id="reason"
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reason: event.target.value }))
                }
              >
                <option value="manual_adjustment">Manual adjustment</option>
                <option value="restock">Restock</option>
                <option value="return">Return</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Optional note for the movement log"
            />
          </div>
        </form>
      </Dialog>
    </>
  )
}
