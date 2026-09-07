import { UserPlus } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  description,
  footerHint,
  footerAction,
  children
}: {
  title: string
  description?: string
  footerHint?: string
  footerAction?: { href: string; label: string }
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="size-5" />
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {children}
          {footerHint && footerAction ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {footerHint}{' '}
              <a href={footerAction.href} className="font-medium text-primary hover:underline">
                {footerAction.label}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
