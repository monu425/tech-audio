'use client'

import { useCallback, useEffect, useState } from 'react'
import { Heart, LayoutDashboard, LogOut, MapPin, Package, Settings, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson, postJson } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PublicUser } from '@/lib/store-types'

const NAV_ITEMS = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/settings', label: 'Settings', icon: Settings }
]

export function AccountShell({
  children,
  active,
  title
}: {
  children: React.ReactNode
  active: string
  title: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<PublicUser | null | undefined>(undefined)

  const load = useCallback(() => {
    let activeRequest = true
    getJson<{ user: PublicUser }>('/auth/me')
      .then((data) => {
        if (activeRequest) setUser(data.user)
      })
      .catch(() => {
        if (activeRequest) setUser(null)
      })
    return () => {
      activeRequest = false
    }
  }, [])

  useEffect(() => load(), [load, pathname])

  const logout = useCallback(async () => {
    await postJson('/auth/logout', {}).catch(() => undefined)
    router.push('/login')
    router.refresh()
  }, [router])

  if (user === undefined) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-8 h-64 w-full" />
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <User className="size-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Sign in to continue</h1>
        <p className="text-muted-foreground">You need to be signed in to view this page.</p>
        <Button asChild size="lg">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-60">
          <div className="mb-4 flex items-center gap-3 rounded-xl border p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active === item.href
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>
          {children}
        </section>
      </div>
    </div>
  )
}
