'use client'

import { useCallback, useEffect, useState } from 'react'
import { Laptop, MonitorSmartphone, Shield, Trash2, UserCog } from 'lucide-react'

import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteJson, getJson, isApiError, patchJson, postJson } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import type { SessionInfo } from '@/lib/store-types'

function fieldError(fields: Record<string, string> | null, key: string) {
  return fields?.[key] ? <p className="text-sm text-destructive">{fields[key]}</p> : null
}

export default function SettingsPage() {
  return (
    <AccountShell active="/account/settings" title="Settings">
      <div className="space-y-6">
        <ProfileCard />
        <ChangePasswordCard />
        <SessionsCard />
      </div>
    </AccountShell>
  )
}

function ProfileCard() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getJson<{ user: { name: string; email: string } }>('/auth/me')
      .then((data) => {
        setName(data.user.name)
        setEmail(data.user.email)
      })
      .catch(() => undefined)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setSaved(false)
    try {
      await patchJson('/auth/me', { name })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="size-4" />
          Profile
        </CardTitle>
        <CardDescription>
          Update your display name. Email changes are not supported yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Full name</Label>
            <Input
              id="settings-name"
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={email} disabled />
          </div>
          {saved ? <p className="text-sm text-emerald-600">Profile updated.</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string> | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setFields(null)
    setDone(false)
    try {
      await postJson('/auth/change-password', { currentPassword, newPassword, confirmPassword })
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message)
        setFields(err.fields)
      } else {
        setError('Could not change password.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            {fieldError(fields, 'currentPassword')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            {fieldError(fields, 'newPassword')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {fieldError(fields, 'confirmPassword')}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {done ? <p className="text-sm text-emerald-600">Password changed successfully.</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SessionsCard() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)

  const load = useCallback(() => {
    getJson<{ sessions: SessionInfo[] }>('/auth/sessions')
      .then((data) => setSessions(data.sessions))
      .catch(() => setSessions([]))
  }, [])

  useEffect(() => load(), [load])

  async function revoke(sessionId: string) {
    await deleteJson(`/auth/sessions/${sessionId}`).catch(() => undefined)
    load()
  }

  async function revokeOthers() {
    await postJson('/auth/sessions/revoke-others', {}).catch(() => undefined)
    load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorSmartphone className="size-4" />
          Active sessions
        </CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <ul className="divide-y">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <Laptop className="size-5 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">
                        {session.deviceName || 'Unknown device'}
                        {session.current ? (
                          <span className="ml-2 text-xs text-emerald-600">This device</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active {formatDateTime(session.lastUsedAt)} ·{' '}
                        {session.createdAt ? `signed in ${formatDateTime(session.createdAt)}` : ''}
                      </p>
                    </div>
                  </div>
                  {!session.current ? (
                    <Button variant="ghost" size="sm" onClick={() => void revoke(session.id)}>
                      <Trash2 className="size-3.5" />
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {sessions.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void revokeOthers()}
              >
                Sign out all other devices
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
