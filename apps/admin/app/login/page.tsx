'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Store } from 'lucide-react'

import { postJson, isApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorAlert } from '@/components/admin/primitives'

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? 'http://localhost:3000'
const ADMIN_ROLES = new Set(['super_admin', 'admin'])

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await postJson<{ user?: { role?: string } }>('/auth/login', {
        email,
        password
      })
      if (!result?.user || !ADMIN_ROLES.has(result.user.role ?? '')) {
        // The API authenticates any account; reject non-admins here so a
        // customer account never lands on the admin dashboard.
        await postJson('/auth/logout').catch(() => undefined)
        setError('Your account is not an administrator.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          <CardTitle className="text-xl">Voltify Admin</CardTitle>
          <CardDescription>Sign in with an administrator account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? <ErrorAlert message={error} /> : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Not an admin?{' '}
              <a
                href={STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Visit the storefront
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
