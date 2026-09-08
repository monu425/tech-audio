'use client'

import * as React from 'react'
import { Save } from 'lucide-react'

import { getJson, patchJson } from '@/lib/api'
import type { PlatformSettings } from '@/lib/admin-types'
import { PERMISSIONS, useSession } from '@/lib/session'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader } from '@/components/admin/primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

function SettingsForm({ data, readOnly }: { data: PlatformSettings; readOnly: boolean }) {
  const [storeName, setStoreName] = React.useState(data.store.storeName)
  const [storeEmail, setStoreEmail] = React.useState(data.store.storeEmail)
  const [taxRatePercent, setTaxRatePercent] = React.useState(String(data.taxRatePercent ?? 0))
  const [saved, setSaved] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setSaved(false)
    setActionError(null)
    try {
      const next = await patchJson<PlatformSettings>('/admin/settings', {
        storeName,
        storeEmail,
        taxRatePercent: Number(taxRatePercent)
      })
      setStoreName(next.store.storeName)
      setStoreEmail(next.store.storeEmail)
      setTaxRatePercent(String(next.taxRatePercent ?? 0))
      setSaved(true)
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Store settings</CardTitle>
        <CardDescription>
          These values are used in checkout, receipts and administrative surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {readOnly ? (
          <p className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            You have view-only access to these settings.
          </p>
        ) : null}
        <form onSubmit={save} className="space-y-4">
          {actionError ? <ErrorAlert message={actionError} className="mb-2" /> : null}
          <Field label="Store name *">
            <Input
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              required
              minLength={2}
              disabled={readOnly}
            />
          </Field>
          <Field label="Store email *">
            <Input
              type="email"
              value={storeEmail}
              onChange={(event) => setStoreEmail(event.target.value)}
              required
              disabled={readOnly}
            />
          </Field>
          <Field
            label="Tax rate (%)"
            hint="Applied to order subtotals at checkout. Set to 0 to disable."
          >
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={taxRatePercent}
              onChange={(event) => setTaxRatePercent(event.target.value)}
              disabled={readOnly}
            />
          </Field>
          {!readOnly ? (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                <Save /> {busy ? 'Saving…' : 'Save settings'}
              </Button>
              {saved ? <span className="text-sm text-emerald-600">Saved successfully.</span> : null}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const session = useSession()
  const { data, loading, error } = useAsync<PlatformSettings>(() => getJson('/admin/settings'), [])
  const readOnly = session.loading || !session.hasPermission(PERMISSIONS.SETTINGS_MANAGE)

  return (
    <>
      <PageHeader title="Settings" description="Configure store identity and platform defaults." />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {data ? <SettingsForm data={data} readOnly={readOnly} /> : null}

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
                <CardDescription>Order amounts are denominated in this currency.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data?.currency ?? 'USD'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shipping methods</CardTitle>
                <CardDescription>Flat-rate methods offered at checkout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.shippingMethods ?? []).map((method) => (
                  <div key={method.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{method.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{method.description}</p>
                    {method.estimatedDays ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Est. {method.estimatedDays}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
