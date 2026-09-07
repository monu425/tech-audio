import { Suspense } from 'react'

import { RegisterForm } from '@/components/auth-forms'
import { AuthShell } from '@/components/auth-shell'

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Join Voltify to track orders, save wishlists and checkout faster."
      footerHint="Already have an account?"
      footerAction={{ href: '/login', label: 'Sign in' }}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  )
}
