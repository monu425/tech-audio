'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'

import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteJson, getJson, isApiError, postJson, putJson } from '@/lib/api'
import type { Address, AddressInput } from '@/lib/store-types'

const EMPTY_FORM: AddressInput = {
  fullName: '',
  line1: '',
  line2: null,
  city: '',
  state: null,
  postalCode: '',
  country: 'US',
  phone: null,
  label: null,
  isDefault: false
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getJson<Address[] | { items: Address[] }>('/addresses')
      .then((data) => setAddresses(Array.isArray(data) ? data : data.items))
      .catch(() => setAddresses([]))
  }, [])

  useEffect(() => load(), [load])

  async function remove(address: Address) {
    if (!window.confirm(`Delete address "${address.fullName}"?`)) return
    setError(null)
    try {
      await deleteJson(`/addresses/${address.id}`)
      load()
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not delete address.')
    }
  }

  return (
    <AccountShell active="/account/addresses" title="Addresses">
      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {addresses === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addresses.map((address) => (
            <div key={address.id} className="flex flex-col rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="size-4 text-primary" />
                  {address.label ?? address.fullName}
                  {address.isDefault ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                      Default
                    </span>
                  ) : null}
                </div>
              </div>
              <address className="mt-3 flex-1 text-sm not-italic text-muted-foreground">
                <div className="text-foreground">{address.fullName}</div>
                <div>{address.line1}</div>
                {address.line2 ? <div>{address.line2}</div> : null}
                <div>
                  {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </div>
                <div>{address.country}</div>
                {address.phone ? <div>{address.phone}</div> : null}
              </address>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(address)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => void remove(address)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <Plus className="size-5" />
            Add new address
          </button>
        </div>
      )}

      {editing ? (
        <AddressForm
          key={editing === 'new' ? 'new' : editing.id}
          address={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
            load()
          }}
        />
      ) : null}
    </AccountShell>
  )
}

function AddressForm({ address, onClose }: { address: Address | null; onClose: () => void }) {
  const [form, setForm] = useState<AddressInput>(
    address
      ? {
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
          label: address.label,
          isDefault: address.isDefault
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setFields(null)
    try {
      if (address) {
        await putJson(`/addresses/${address.id}`, form)
      } else {
        await postJson('/addresses', form)
      }
      onClose()
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message)
        setFields(err.fields)
      } else {
        setError('Could not save address.')
      }
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'grid gap-1.5'
  const fieldError = (key: string) =>
    fields ? <p className="text-sm text-destructive">{fields[key]}</p> : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border bg-background p-6"
      >
        <h2 className="text-lg font-semibold">{address ? 'Edit address' : 'New address'}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={inputClass}>
            <Label htmlFor="addr-fullName">Full name</Label>
            <Input
              id="addr-fullName"
              required
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
            />
            {fieldError('fullName')}
          </div>
          <div className={inputClass}>
            <Label htmlFor="addr-label">Label</Label>
            <Input
              id="addr-label"
              placeholder="Home / Office"
              value={form.label ?? ''}
              onChange={(event) => set('label', event.target.value || null)}
            />
          </div>
          <div className={inputClass}>
            <Label htmlFor="addr-phone">Phone</Label>
            <Input
              id="addr-phone"
              placeholder="+1 …"
              value={form.phone ?? ''}
              onChange={(event) => set('phone', event.target.value || null)}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className={inputClass}>
            <Label htmlFor="addr-line1">Address line 1</Label>
            <Input
              id="addr-line1"
              required
              value={form.line1}
              onChange={(event) => set('line1', event.target.value)}
            />
            {fieldError('line1')}
          </div>
          <div className={inputClass}>
            <Label htmlFor="addr-line2">Address line 2 (optional)</Label>
            <Input
              id="addr-line2"
              value={form.line2 ?? ''}
              onChange={(event) => set('line2', event.target.value || null)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={inputClass}>
            <Label htmlFor="addr-city">City</Label>
            <Input
              id="addr-city"
              required
              value={form.city}
              onChange={(event) => set('city', event.target.value)}
            />
            {fieldError('city')}
          </div>
          <div className={inputClass}>
            <Label htmlFor="addr-state">State / Region</Label>
            <Input
              id="addr-state"
              value={form.state ?? ''}
              onChange={(event) => set('state', event.target.value || null)}
            />
          </div>
          <div className={inputClass}>
            <Label htmlFor="addr-postal">Postal code</Label>
            <Input
              id="addr-postal"
              required
              value={form.postalCode}
              onChange={(event) => set('postalCode', event.target.value)}
            />
            {fieldError('postalCode')}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={inputClass}>
            <Label htmlFor="addr-country">Country (2-letter)</Label>
            <Input
              id="addr-country"
              maxLength={2}
              required
              className="uppercase"
              value={form.country}
              onChange={(event) => set('country', event.target.value.toUpperCase())}
            />
            {fieldError('country')}
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={form.isDefault ?? false}
              onChange={(event) => set('isDefault', event.target.checked)}
            />
            Set as default
          </label>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save address'}
          </Button>
        </div>
      </form>
    </div>
  )
}
