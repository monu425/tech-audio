'use client'

import { useCallback, useEffect, useState } from 'react'
import { Heart, ShoppingBag, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteJson, getJson, isApiError, postJson } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import type { CartDto } from '@/lib/store-types'

interface WishlistItem {
  product: {
    id: string
    name: string
    slug: string
    sku: string
    image: { url: string; alt?: string | null } | null
    priceMinor: number
    compareAtMinor: number | null
    availableStock: number
    discountPercent: number | null
  }
  addedAt: string
}

export default function WishlistPage() {
  const router = useRouter()
  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [meta, setMeta] = useState<{ totalItems: number }>({ totalItems: 0 })
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    getJson<{ items: WishlistItem[]; meta: { totalItems: number } }>('/wishlist')
      .then((data) => {
        setItems(data.items)
        setMeta(data.meta)
      })
      .catch(() => setItems([]))
  }, [])

  useEffect(() => load(), [load])

  async function remove(productId: string) {
    try {
      await deleteJson(`/wishlist/items/${productId}`)
      load()
    } catch (error) {
      setMessage(isApiError(error) ? error.message : 'Could not remove item.')
    }
  }

  async function addToCart(productId: string, slug: string) {
    setMessage(null)
    try {
      await postJson<CartDto>('/wishlist/items/move-to-cart', { productId })
      load()
      setMessage('Moved to your cart.')
    } catch (error) {
      if (isApiError(error) && error.code === 'VARIANT_REQUIRED') {
        router.push(`/products/${slug}`)
      } else {
        setMessage(isApiError(error) ? error.message : 'Could not move item to cart.')
      }
    }
  }

  return (
    <AccountShell active="/account/wishlist" title="Wishlist">
      {message ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border py-20 text-center">
          <Heart className="size-8 text-muted-foreground" />
          <p className="text-lg font-medium">Your wishlist is empty</p>
          <p className="text-sm text-muted-foreground">
            Save products you like and come back later.
          </p>
          <Button asChild className="mt-2">
            <Link href="/products">Discover products</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ product }) => (
            <div key={product.id} className="flex flex-col overflow-hidden rounded-xl border">
              <Link href={`/products/${product.slug}`} className="relative aspect-square bg-muted">
                {product.image ? (
                  <Image
                    src={product.image.url}
                    alt={product.image.alt ?? product.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : null}
                {product.discountPercent ? (
                  <span className="absolute left-3 top-3 rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
                    -{product.discountPercent}%
                  </span>
                ) : null}
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <Link
                  href={`/products/${product.slug}`}
                  className="line-clamp-1 text-sm font-medium hover:underline"
                >
                  {product.name}
                </Link>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-semibold">{formatMoney(product.priceMinor)}</span>
                  {product.compareAtMinor ? (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatMoney(product.compareAtMinor)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto flex gap-2 pt-3">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={product.availableStock <= 0}
                    onClick={() => void addToCart(product.id, product.slug)}
                  >
                    <ShoppingBag className="size-3.5" />
                    {product.availableStock > 0 ? 'Add to cart' : 'Sold out'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Remove from wishlist"
                    onClick={() => void remove(product.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        {meta.totalItems > 0
          ? `${meta.totalItems} saved item${meta.totalItems === 1 ? '' : 's'}`
          : ''}
      </p>
    </AccountShell>
  )
}
