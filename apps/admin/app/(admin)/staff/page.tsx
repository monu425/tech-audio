'use client'

import * as React from 'react'
import { Plus, Search } from 'lucide-react'

import { getJson, postJson, patchJson } from '@/lib/api'
import type { StaffMember, PageMeta } from '@/lib/admin-types'
import { formatDate, formatDateTime } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import {
  ErrorAlert,
  LoadingCard,
  PageHeader,
  StatusBadge,
  Pagination,
  useListQuery
} from '@/components/admin/primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ListResponse = { items: StaffMember[]; meta: PageMeta }

type FormState = { name: string; email: string; password: string; role: string }

const EMPTY: FormState = { name: '', email: '', password: '', role: 'admin' }

export default function StaffPage() {
  const { page, searchParams, setQuery, setPage } = useListQuery()
  const q = searchParams.get('q') ?? ''
  const [searchInput, setSearchInput] = React.useState(q)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('page', String(page))

  const { data, loading, error, reload } = useAsync<ListResponse>(
    () => getJson(`/admin/staff?${params.toString()}`),
    [q, page]
  )

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const openCreate = () => {
    setForm(EMPTY)
    setActionError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      await postJson('/admin/staff', form)
      setOpen(false)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (staff: StaffMember, role: string) => {
    try {
      await patchJson(`/admin/staff/${staff.id}/role`, { role })
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  const changeStatus = async (staff: StaffMember) => {
    const next = staff.status === 'active' ? 'inactive' : 'active'
    try {
      await patchJson(`/admin/staff/${staff.id}/status`, { status: next })
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Staff" description="Manage administrator accounts and roles.">
        <Button onClick={openCreate}>
          <Plus /> New staff
        </Button>
      </PageHeader>

      <div className="mb-4 flex items-center gap-3">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault()
            setQuery({ q: searchInput || undefined, page: undefined })
          }}
        >
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or email…"
            className="w-72 pl-8"
            aria-label="Search staff"
          />
        </form>
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
                  <TableHead>Staff member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="font-medium">{staff.name}</div>
                      <div className="text-sm text-muted-foreground">{staff.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={staff.role}
                        aria-label={`Role for ${staff.name}`}
                        className="w-36"
                        onChange={(event) => void changeRole(staff, event.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="user" value={staff.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {staff.lastLoginAt ? formatDateTime(staff.lastLoginAt) : 'Never'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(staff.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => void changeStatus(staff)}>
                        {staff.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!(data?.items ?? []).length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No staff members found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
      <p className="mt-3 text-xs text-muted-foreground">
        Roles: <strong>Admin</strong> manages the store; <strong>Super admin</strong> can also
        manage staff and roles.
      </p>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Invite staff member"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" disabled={busy}>
              {busy ? 'Creating…' : 'Create staff'}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={submit} className="space-y-4">
          {actionError ? <ErrorAlert message={actionError} /> : null}
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </Field>
          <Field label="Email *">
            <Input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Password *" hint="At least 8 characters.">
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Role *">
            <Select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </Select>
          </Field>
        </form>
      </Dialog>
    </>
  )
}
