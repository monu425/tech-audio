'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { postJson, isApiError } from '@/lib/api'

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await postJson('/auth/login', { email, password })
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordField
          id="login-password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((show) => !show)}
          autoComplete="current-password"
        />
      </div>
      <FieldError message={error} />
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setFields({ confirmPassword: 'Passwords do not match' })
      return
    }
    setBusy(true)
    setError(null)
    setFields(null)
    try {
      await postJson('/auth/register', { name, email, password, confirmPassword })
      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message)
        setFields(err.fields)
      } else {
        setError('Unable to create account.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-name">Full name</Label>
        <Input
          id="reg-name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError message={fields?.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldError message={fields?.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <PasswordField
          id="reg-password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((show) => !show)}
          autoComplete="new-password"
        />
        <FieldError message={fields?.password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-confirm">Confirm password</Label>
        <PasswordField
          id="reg-confirm"
          value={confirmPassword}
          onChange={setConfirmPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((show) => !show)}
          autoComplete="new-password"
        />
        <FieldError message={fields?.confirmPassword} />
      </div>
      <FieldError message={error} />
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}

export function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const next = searchParams.get('next') ?? '/'
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setFields(null)
    try {
      await postJson('/auth/verify-email', { email, code })
      router.push(next)
      router.refresh()
    } catch (err) {
      if (isApiError(err)) {
        setError(err.fields ? err.message : err.message)
        setFields(err.fields)
      } else {
        setError('Unable to verify your email.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    setError(null)
    try {
      await postJson('/auth/resend-verification', { email })
      setNotice('A new verification code has been sent.')
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Unable to resend the code.')
    } finally {
      setBusy(false)
    }
  }

  if (!email) {
    return (
      <p className="text-sm text-muted-foreground">
        No email address provided. Please register first.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit verification code to{' '}
        <span className="font-medium text-foreground">{email}</span>.
      </p>
      <div className="space-y-2">
        <Label htmlFor="verify-code">Verification code</Label>
        <Input
          id="verify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="text-center text-lg tracking-[0.5em]"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        />
        <FieldError message={fields?.code} />
      </div>
      <FieldError message={error} />
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={busy || code.length !== 6}>
        {busy ? 'Verifying…' : 'Verify email'}
      </Button>
      <button
        type="button"
        onClick={() => void resend()}
        className="w-full text-center text-sm text-primary hover:underline disabled:opacity-50"
        disabled={busy}
      >
        Resend code
      </button>
    </form>
  )
}

export function ForgotPasswordForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await postJson('/auth/forgot-password', { email })
      setNotice('If an account exists for that email, a reset code has been sent.')
      setTimeout(() => router.push(`/reset-password?email=${encodeURIComponent(email)}`), 1200)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Unable to send reset code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <FieldError message={error} />
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? 'Sending…' : 'Send reset code'}
      </Button>
    </form>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setFields({ confirmPassword: 'Passwords do not match' })
      return
    }
    setBusy(true)
    setError(null)
    setFields(null)
    try {
      await postJson('/auth/reset-password', {
        email,
        code,
        newPassword: password,
        confirmPassword
      })
      router.push('/login')
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message)
        setFields(err.fields)
      } else {
        setError('Unable to reset your password.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-code">Reset code</Label>
        <Input
          id="reset-code"
          inputMode="numeric"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        />
        <FieldError message={fields?.code} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-password">New password</Label>
        <PasswordField
          id="reset-password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((show) => !show)}
          autoComplete="new-password"
        />
        <FieldError message={fields?.newPassword} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <PasswordField
          id="reset-confirm"
          value={confirmPassword}
          onChange={setConfirmPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((show) => !show)}
          autoComplete="new-password"
        />
        <FieldError message={fields?.confirmPassword} />
      </div>
      <FieldError message={error} />
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? 'Resetting…' : 'Reset password'}
      </Button>
    </form>
  )
}

function PasswordField({
  id,
  value,
  onChange,
  showPassword,
  onToggleShow,
  autoComplete
}: {
  id: string
  value: string
  onChange: (value: string) => void
  showPassword: boolean
  onToggleShow: () => void
  autoComplete?: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
