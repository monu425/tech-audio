'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'

import { getJson, postJson, patchJson } from '@/lib/api'
import type { CategoryRow } from '@/lib/admin-types'
import { formatDate } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader, StatusBadge } from '@/components/admin/primitives'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type FormState = {
  name: string
  description: string
  parentId: string
  imageUrl: string
}

const EMPTY: FormState = { name: '', description: '', parentId: '', imageUrl: '' }

export default function CategoriesPage() {
  const { data, loading, error, reload } = useAsync<{ items: CategoryRow[] }>(
    () => getJson('/admin/categories'),
    []
  )

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CategoryRow | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setActionError(null)
    setOpen(true)
  }

  const openEdit = (category: CategoryRow) => {
    setEditing(category)
    setForm({
      name: category.name,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      imageUrl: category.imageUrl ?? ''
    })
    setActionError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        imageUrl: form.imageUrl || null
      }
      if (!editing) body.parentId = form.parentId || null
      if (editing) {
        await patchJson(`/admin/categories/${editing.id}`, body)
      } else {
        await postJson('/admin/categories', body)
      }
      setOpen(false)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (category: CategoryRow) => {
    try {
      if (category.status === 'active') {
        await postJson(`/admin/categories/${category.id}/archive`)
      } else {
        await patchJson(`/admin/categories/${category.id}`, { status: 'active' })
      }
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  const byId = new Map((data?.items ?? []).map((category) => [category.id, category]))
  const parentLabel = (parentId: string | null) =>
    parentId ? (byId.get(parentId)?.name ?? '—') : '—'

  return (
    <>
      <PageHeader title="Categories" description="Organize the catalog into browsable collections.">
        <Button onClick={openCreate}>
          <Plus /> New category
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
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {parentLabel(category.parentId)}
                    </TableCell>
                    <TableCell className="text-right">{category.productsCount}</TableCell>
                    <TableCell>
                      <StatusBadge kind="product" value={category.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(category.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(category)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleStatus(category)}
                        >
                          {category.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.items.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No categories yet.
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
        title={editing ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={submit} className="space-y-4">
          {actionError ? <ErrorAlert message={actionError} /> : null}
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </Field>
          {!editing ? (
            <Field
              label="Parent category"
              hint="Optional. Nested categories appear under a parent."
            >
              <Select
                value={form.parentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, parentId: event.target.value }))
                }
              >
                <option value="">No parent (top level)</option>
                {(data?.items ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <Field label="Image" hint="Shown as a header image for the category.">
            <Input
              value={form.imageUrl}
              placeholder="https://…"
              onChange={(event) =>
                setForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
            />
            <ImageUpload
              className="mt-2"
              value={form.imageUrl || null}
              disabled={busy}
              onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
              onClear={() => setForm((current) => ({ ...current, imageUrl: '' }))}
            />
          </Field>
          {editing ? (
            <p className="text-xs text-muted-foreground">
              Slug will be regenerated from the name automatically.
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  )
}
