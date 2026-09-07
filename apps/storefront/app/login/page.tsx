import { Suspense } from 'react'

import { LoginForm } from '@/components/auth-forms'
import { AuthShell } from '@/components/auth-shell'

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Voltify account to checkout faster."
      footerHint="New to Voltify?"
      footerAction={{ href: '/register', label: 'Create an account' }}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
