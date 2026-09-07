import { ArrowRight, BadgeCheck, RefreshCcw, ShieldCheck, Truck } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { ProductCard } from '@/components/product-card'
import { Button } from '@/components/ui/button'
import type { ProductSummary } from '@/lib/store-types'

export const dynamic = 'force-dynamic'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1'

interface CategoryChip {
  id: string
  name: string
  slug: string
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', Origin: 'http://localhost:3000' },
      cache: 'no-store'
    })
    if (!res.ok) return null
    const payload = (await res.json()) as { data?: unknown; items?: unknown }
    const data = payload.data ?? payload.items
    return (data ?? null) as T | null
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [featured, saleData, categoryData] = await Promise.all([
    fetchJson<ProductSummary[]>('/catalog/featured?limit=8'),
    fetchJson<{ items: ProductSummary[] }>(
      '/catalog/products?onSale=true&sort=price_asc&pageSize=8'
    ),
    fetchJson<{ items: CategoryChip[] }>('/catalog/categories')
  ])

  const featuredItems = featured ?? []
  const saleItems = saleData?.items ?? []
  const categories = categoryData?.items ?? []

  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
                Voltify · Premium electronics
              </p>
              <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Consumer electronics, engineered for everyday life
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
                Premium earbuds, projectors, keyboards, mice and phone accessories — curated,
                guaranteed and delivered fast.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/products">
                    Shop now <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/products?onSale=true">Shop deals</Link>
                </Button>
              </div>
            </div>
            {featuredItems[0]?.image ? (
              <div className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl lg:block">
                <Image
                  src={featuredItems[0].image.url}
                  alt={featuredItems[0].image.alt ?? featuredItems[0].name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 0px, 50vw"
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            {categories.slice(0, 12).map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="rounded-full border bg-background px-4 py-2 text-sm font-medium capitalize transition-colors hover:border-primary hover:text-primary"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featuredItems.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Featured products</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hand-picked favourites from the catalogue.
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link href="/products">
                View all <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {featuredItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {saleItems.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Today&apos;s deals</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Limited-time savings on popular items.
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link href="/products?onSale=true">
                All deals <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {saleItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: 'Fast delivery', text: 'Free shipping on orders over $150.' },
            { icon: ShieldCheck, title: '2-year warranty', text: 'Every product is protected.' },
            { icon: RefreshCcw, title: 'Easy returns', text: '30-day hassle-free returns.' },
            { icon: BadgeCheck, title: 'Secure checkout', text: 'Pay safely on delivery.' }
          ].map((item) => (
            <div key={item.title} className="flex gap-3 rounded-xl border p-4">
              <item.icon className="size-6 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
