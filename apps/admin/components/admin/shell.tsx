'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Tags,
  TicketPercent,
  Users,
  X
} from 'lucide-react'

import { useSession, PERMISSIONS } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission: string
  matchPrefix?: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permission: PERMISSIONS.DASHBOARD_READ
      },
      {
        href: '/reports',
        label: 'Reports',
        icon: BarChart3,
        permission: PERMISSIONS.REPORT_READ
      }
    ]
  },
  {
    title: 'Commerce',
    items: [
      {
        href: '/products',
        label: 'Products',
        icon: Package,
        permission: PERMISSIONS.PRODUCT_READ,
        matchPrefix: '/products'
      },
      {
        href: '/orders',
        label: 'Orders',
        icon: ShoppingCart,
        permission: PERMISSIONS.ORDER_READ,
        matchPrefix: '/orders'
      },
      {
        href: '/customers',
        label: 'Customers',
        icon: Users,
        permission: PERMISSIONS.CUSTOMER_READ,
        matchPrefix: '/customers'
      },
      {
        href: '/coupons',
        label: 'Coupons',
        icon: TicketPercent,
        permission: PERMISSIONS.COUPON_MANAGE,
        matchPrefix: '/coupons'
      },
      {
        href: '/reviews',
        label: 'Reviews',
        icon: Star,
        permission: PERMISSIONS.REVIEW_MODERATE,
        matchPrefix: '/reviews'
      }
    ]
  },
  {
    title: 'Catalog',
    items: [
      {
        href: '/categories',
        label: 'Categories',
        icon: FolderTree,
        permission: PERMISSIONS.CATEGORY_MANAGE
      },
      {
        href: '/brands',
        label: 'Brands',
        icon: Tags,
        permission: PERMISSIONS.BRAND_MANAGE
      }
    ]
  },
  {
    title: 'System',
    items: [
      {
        href: '/staff',
        label: 'Staff & roles',
        icon: ShieldCheck,
        permission: PERMISSIONS.ADMIN_MANAGE
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        permission: PERMISSIONS.SETTINGS_MANAGE
      }
    ]
  }
]

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? 'http://localhost:3000'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { me, hasPermission } = useSession()

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 border-b px-4 py-4 font-semibold tracking-tight"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Store className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span>Voltify Admin</span>
          <span className="text-xs font-normal text-muted-foreground">
            {me?.roleLabel ?? 'Dashboard'}
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => hasPermission(item.permission))
          if (visible.length === 0) return null
          return (
            <div key={group.title}>
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const active = item.matchPrefix
                    ? pathname.startsWith(item.matchPrefix)
                    : pathname === item.href
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t px-4 py-3">
        <a
          href={STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-4" />
          View storefront
        </a>
      </div>
    </div>
  )
}

function HeaderActions() {
  const { me, signOut } = useSession()
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{me?.user.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{me?.user.email ?? ''}</p>
      </div>
      <Badge
        variant={me?.user.role === 'super_admin' ? 'default' : 'secondary'}
        className="hidden sm:inline-flex"
      >
        {me?.user.role === 'super_admin' ? 'Super admin' : 'Admin'}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={() => void signOut()}
        title="Sign out"
      >
        <LogOut />
      </Button>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-muted/40 p-6">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-6 w-80" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72" />
    </div>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useSession()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    if (!loading && !me) {
      router.replace('/login')
    }
  }, [loading, me, router])

  if (loading || !me) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:block">
        <SidebarContent />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-lg">
            <button
              className="absolute right-3 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <div className="flex-1" />
          <HeaderActions />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
