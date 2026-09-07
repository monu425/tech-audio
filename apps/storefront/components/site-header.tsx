'use client'

import { useEffect, useState } from 'react'
import { Search, ShoppingBag, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getJson } from '@/lib/api'
import type { PublicUser } from '@/lib/store-types'

export function SiteHeader() {
  const cart = useCart()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [user, setUser] = useState<PublicUser | null>(null)

  const itemCount = cart.cart?.totals.itemsCount ?? 0

  useEffect(() => {
    let active = true
    getJson<{ user: PublicUser }>('/auth/me')
      .then((data) => {
        if (active) setUser(data.user)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    return () => {
      active = false
    }
  }, [pathname])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const q = query.trim()
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="size-4" />
          </span>
          <span className="hidden sm:inline">Voltify</span>
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
          <Link className="transition-colors hover:text-foreground" href="/products">
            Shop
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/categories">
            Categories
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/products?onSale=true">
            Deals
          </Link>
        </nav>

        <form
          onSubmit={submitSearch}
          className="ml-auto flex min-w-0 flex-1 items-center md:max-w-xs"
        >
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="pl-9"
            />
          </div>
        </form>

        <div className="flex shrink-0 items-center gap-1.5">
          {user ? (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/account">
                <User className="size-4" />
                {user.name.split(' ')[0]}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open cart"
            onClick={() => cart.setOpen(true)}
            className="relative"
          >
            <ShoppingBag className="size-5" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t px-4 py-2 text-sm text-muted-foreground md:hidden">
        <Link className="hover:text-foreground" href="/products">
          Shop
        </Link>
        <Link className="hover:text-foreground" href="/categories">
          Categories
        </Link>
        <Link className="hover:text-foreground" href="/products?onSale=true">
          Deals
        </Link>
        {!user && (
          <Link className="ml-auto font-medium hover:text-foreground" href="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
