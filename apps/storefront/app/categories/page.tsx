import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1'

interface PublicCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: { url: string } | null
  productCount?: number
  children: PublicCategory[]
}

async function loadTree(): Promise<PublicCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/catalog/category-tree`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
    if (!res.ok) return []
    const payload = (await res.json()) as { data?: PublicCategory[] }
    return payload.data ?? []
  } catch {
    return []
  }
}

export default async function CategoriesPage() {
  const roots = await loadTree()
  const flat = roots.flatMap((root) => [root, ...(root.children ?? [])])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Shop by category</h1>
        <p className="mt-2 text-muted-foreground">
          Browse the whole catalogue organised by category.
        </p>
      </div>

      {flat.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border py-20 text-center">
          <p className="text-muted-foreground">Categories are not available right now.</p>
          <Button asChild>
            <Link href="/products">Browse all products</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flat.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${encodeURIComponent(category.slug)}`}
              className="group rounded-xl border p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="capitalize group-hover:text-primary">{category.name}</h2>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              {category.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {category.description}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                {category.children?.length
                  ? `${category.children.length} sub-categories`
                  : 'Shop the range'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
