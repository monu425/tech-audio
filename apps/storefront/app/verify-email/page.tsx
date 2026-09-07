import { Suspense } from 'react'
import { MailCheck } from 'lucide-react'

import { VerifyEmailForm } from '@/components/auth-forms'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MailCheck className="size-5" />
            Verify your email
          </CardTitle>
          <CardDescription>
            Enter the verification code we emailed you to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <VerifyEmailForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
