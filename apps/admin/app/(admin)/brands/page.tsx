'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'

import { getJson, postJson, patchJson } from '@/lib/api'
import type { BrandRow } from '@/lib/admin-types'
import { formatDate } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader, StatusBadge } from '@/components/admin/primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/admin/image-upload'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type FormState = { name: string; description: string; logoUrl: string }

const EMPTY: FormState = { name: '', description: '', logoUrl: '' }

export default function BrandsPage() {
  const { data, loading, error, reload } = useAsync<{ items: BrandRow[] }>(
    () => getJson('/admin/brands'),
    []
  )

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BrandRow | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setActionError(null)
    setOpen(true)
  }

  const openEdit = (brand: BrandRow) => {
    setEditing(brand)
    setForm({
      name: brand.name,
      description: brand.description ?? '',
      logoUrl: brand.logoUrl ?? ''
    })
    setActionError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      const body = { name: form.name, description: form.description, logoUrl: form.logoUrl || null }
      if (editing) {
        await patchJson(`/admin/brands/${editing.id}`, body)
      } else {
        await postJson('/admin/brands', body)
      }
      setOpen(false)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (brand: BrandRow) => {
    try {
      if (brand.status === 'active') {
        await postJson(`/admin/brands/${brand.id}/archive`)
      } else {
        await patchJson(`/admin/brands/${brand.id}`, { status: 'active' })
      }
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Brands" description="Manage brands used across the catalog.">
        <Button onClick={openCreate}>
          <Plus /> New brand
        </Button>
      </PageHeader>

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
                  <TableHead>Brand</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {brand.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={brand.logoUrl}
                            alt=""
                            className="size-8 rounded-md border object-cover"
                          />
                        ) : (
                          <span className="flex size-8 items-center justify-center rounded-md border bg-muted text-xs font-semibold">
                            {brand.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="font-medium">{brand.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{brand.slug}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {brand.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="product" value={brand.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(brand.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(brand)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void toggleStatus(brand)}>
                          {brand.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.items.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No brands yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit brand' : 'New brand'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="brand-form" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create brand'}
            </Button>
          </>
        }
      >
        <form id="brand-form" onSubmit={submit} className="space-y-4">
          {actionError ? <ErrorAlert message={actionError} /> : null}
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </Field>
          <Field label="Logo URL">
            <Input
              value={form.logoUrl}
              placeholder="https://…"
              onChange={(event) =>
                setForm((current) => ({ ...current, logoUrl: event.target.value }))
              }
            />
            <ImageUpload
              className="mt-2"
              value={form.logoUrl || null}
              disabled={busy}
              onChange={(url) => setForm((current) => ({ ...current, logoUrl: url }))}
              onClear={() => setForm((current) => ({ ...current, logoUrl: '' }))}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
        </form>
      </Dialog>
    </>
  )
}
