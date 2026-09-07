'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useCart } from '@/components/cart-provider'
import { ProductCard } from '@/components/product-card'
import { RatingStars } from '@/components/rating-stars'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson, postJson, deleteJson, ApiError, isApiError } from '@/lib/api'
import { formatMoney, formatStockStatus } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductDetail, ProductSummary, ReviewsListData } from '@/lib/store-types'

export function ProductDetailView({ slug }: { slug: string }) {
  const router = useRouter()
  const cart = useCart()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [reviews, setReviews] = useState<ReviewsListData | null>(null)
  const [related, setRelated] = useState<ProductSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [wishlisted, setWishlisted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [reviewsVersion, setReviewsVersion] = useState(0)
  const [activeTab, setActiveTab] = useState<'description' | 'attributes' | 'reviews'>(
    'description'
  )

  useEffect(() => {
    getJson<{ user: unknown }>('/auth/me')
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false))
  }, [])

  const loadReviews = useCallback(() => {
    let active = true
    getJson<ReviewsListData>(`/catalog/products/${encodeURIComponent(slug)}/reviews?pageSize=8`)
      .then((data) => {
        if (active) setReviews(data)
      })
      .catch(() => {
        if (active) setReviews(null)
      })
    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => loadReviews(), [loadReviews, reviewsVersion])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    getJson<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`, controller.signal)
      .then((data) => {
        if (!active) return
        setProduct(data)
        const initial = data.hasVariants
          ? (data.variants.find((variant) => variant.active) ?? null)
          : null
        setSelectedVariantId(initial?.id ?? null)
      })
      .catch((err) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError('Unable to load this product.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [slug])

  useEffect(() => {
    let active = true
    getJson<{ items: ProductSummary[] }>(
      `/catalog/products/${encodeURIComponent(slug)}/related?limit=8`
    )
      .then((data) => {
        if (active) setRelated(data.items)
      })
      .catch(() => {
        if (active) setRelated([])
      })
    return () => {
      active = false
    }
  }, [slug])

  const activeVariant = useMemo(() => {
    if (!product) return null
    return product.variants.find((variant) => variant.id === selectedVariantId) ?? null
  }, [product, selectedVariantId])

  const priceMinor = activeVariant?.priceMinor ?? product?.priceMinor ?? 0
  const compareAtMinor = activeVariant?.compareAtMinor ?? product?.compareAtMinor ?? null
  const available = activeVariant?.availableStock ?? product?.availableStock ?? 0
  const stockStatus = activeVariant?.stockStatus ?? product?.stockStatus ?? 'out_of_stock'
  const currency = product?.currency ?? 'USD'
  const salePercent =
    compareAtMinor && compareAtMinor > priceMinor
      ? Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100)
      : null

  const addToCart = useCallback(async () => {
    if (!product) return
    if (product.hasVariants && !activeVariant) {
      setError('Please choose a variant.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await cart.addItem({
        productId: product.id,
        variantId: product.hasVariants ? (activeVariant?.id ?? null) : null,
        quantity
      })
      cart.setOpen(true)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not add to cart.')
    } finally {
      setBusy(false)
    }
  }, [product, activeVariant, quantity, cart])

  async function toggleWishlist() {
    if (!product) return
    setBusy(true)
    setError(null)
    try {
      if (wishlisted) {
        await deleteJson(`/wishlist/items/${product.id}`)
        setWishlisted(false)
      } else {
        await postJson('/wishlist/items', { productId: product.id })
        setWishlisted(true)
      }
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        router.push(`/login?next=/products/${slug}`)
      } else {
        setError(isApiError(err) ? err.message : 'Could not update wishlist.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <ProductDetailSkeleton />
  if (notFound)
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">
          This product may be unavailable or no longer exists.
        </p>
        <Button asChild className="mt-6">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    )
  if (!product)
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">{error ?? 'Please try again later.'}</p>
        <Button asChild className="mt-6">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    )

  const stock = formatStockStatus(stockStatus)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {product.breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/products" className="hover:text-foreground">
                Shop
              </Link>
            </li>
            {product.breadcrumb.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5">
                <ChevronRight className="size-3.5" />
                <Link
                  href={`/products?category=${item.slug}`}
                  className={cn(
                    'hover:text-foreground',
                    item.slug === product.breadcrumb[product.breadcrumb.length - 1]?.slug &&
                      'text-foreground'
                  )}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt ?? product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>
          {product.images.length > 1 ? (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {product.images.map((image, index) => (
                <div
                  key={image.url}
                  className={cn(
                    'relative aspect-square w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border',
                    index === 0 ? 'ring-2 ring-ring' : ''
                  )}
                >
                  <Image
                    src={image.url}
                    alt={image.alt ?? `${product.name} ${index + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Summary */}
        <div>
          {product.brand ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {product.brand.name}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>

          {product.ratingAverage != null ? (
            <Link
              href="#reviews"
              className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
            >
              <RatingStars value={product.ratingAverage} />
              <span>
                {Number(product.ratingAverage).toFixed(1)} ({product.ratingCount} reviews)
              </span>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No reviews yet</p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatMoney(priceMinor, currency)}</span>
            {salePercent ? (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  {formatMoney(compareAtMinor ?? 0, currency)}
                </span>
                <span className="rounded-full bg-destructive px-2 py-0.5 text-sm font-semibold text-white">
                  -{salePercent}%
                </span>
              </>
            ) : null}
          </div>

          <p className="mt-4 text-muted-foreground">
            {product.shortDescription ?? product.description}
          </p>

          {product.hasVariants ? (
            <VariantPicker
              product={product}
              selectedVariantId={selectedVariantId}
              onSelect={setSelectedVariantId}
              onReset={() => setQuantity(1)}
            />
          ) : null}

          <div className="mt-6">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                stock.tone === 'green' && 'bg-emerald-50 text-emerald-700',
                stock.tone === 'amber' && 'bg-amber-50 text-amber-700',
                stock.tone === 'red' && 'bg-red-50 text-red-700'
              )}
            >
              {stock.label}
            </span>
            {available <= 5 && available > 0 ? (
              <span className="ml-2 text-sm text-muted-foreground">Only {available} left</span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || busy}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus className="size-4" />
              </Button>
              <span className="min-w-10 text-center text-sm font-medium tabular-nums">
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Increase quantity"
                disabled={quantity >= available || busy}
                onClick={() => setQuantity((current) => Math.min(available, current + 1))}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button
              size="lg"
              className="flex-1 sm:flex-none"
              disabled={busy || available <= 0}
              onClick={() => void addToCart()}
            >
              <ShoppingBag className="size-4" />
              {available > 0 ? 'Add to cart' : 'Sold out'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              aria-label="Add to wishlist"
              disabled={busy}
              onClick={() => void toggleWishlist()}
            >
              <Heart className={cn('size-4', wishlisted && 'fill-red-500 text-red-500')} />
            </Button>
          </div>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <TrustBadge icon={Truck} title="Fast delivery" text="Free shipping over $35" />
            <TrustBadge icon={ShieldCheck} title="Secure checkout" text="Protected payments" />
          </div>

          <dl className="mt-6 border-t pt-4 text-sm">
            <div className="flex gap-4 py-1">
              <dt className="w-24 text-muted-foreground">SKU</dt>
              <dd>{activeVariant?.sku ?? product.sku}</dd>
            </div>
            <div className="flex gap-4 py-1">
              <dt className="w-24 text-muted-foreground">Tags</dt>
              <dd className="flex flex-wrap gap-1">
                {product.tags.length ? (
                  product.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/products?q=${encodeURIComponent(tag)}`}
                      className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {tag}
                    </Link>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-14 border-t">
        <div
          className="flex gap-2 overflow-x-auto py-4"
          role="tablist"
          aria-label="Product details"
        >
          {(
            [
              ['description', 'Description'],
              ['attributes', 'Specifications'],
              ['reviews', `Reviews${product.ratingCount ? ` (${product.ratingCount})` : ''}`]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium',
                activeTab === key
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-w-3xl py-6" role="tabpanel">
          {activeTab === 'description' && (
            <div className="space-y-4 text-muted-foreground">
              {product.description ? (
                product.description
                  .split('\n')
                  .map((paragraph, index) =>
                    paragraph.trim() ? <p key={index}>{paragraph}</p> : null
                  )
              ) : (
                <p>No description available.</p>
              )}
            </div>
          )}

          {activeTab === 'attributes' &&
            (product.attributes.length ? (
              <table className="w-full text-sm">
                <tbody>
                  {product.attributes.map((attribute) => (
                    <tr key={attribute.name} className="border-b last:border-0">
                      <td className="w-1/3 py-3 font-medium">{attribute.name}</td>
                      <td className="py-3 text-muted-foreground">{attribute.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No specifications available.</p>
            ))}

          {activeTab === 'reviews' && (
            <ReviewsSection
              productId={product.id}
              signedIn={signedIn}
              data={reviews}
              onAdded={() => setReviewsVersion((version) => version + 1)}
            />
          )}
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-label="You may also like" className="mt-16">
          <h2 className="text-xl font-bold tracking-tight">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function VariantPicker({
  product,
  selectedVariantId,
  onSelect,
  onReset
}: {
  product: ProductDetail
  selectedVariantId: string | null
  onSelect: (id: string) => void
  onReset: () => void
}) {
  const dimension = product.optionNames[0] ?? 'Options'
  const options = product.variants.filter((variant) => variant.active)
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium">
        {dimension}
        {selectedVariantId ? (
          <span className="ml-2 font-normal text-muted-foreground">
            {options.find((variant) => variant.id === selectedVariantId)?.options[dimension]}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((variant) => (
          <button
            key={variant.id}
            type="button"
            disabled={variant.availableStock <= 0}
            onClick={() => {
              onSelect(variant.id)
              onReset()
            }}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              selectedVariantId === variant.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:border-foreground'
            )}
          >
            {variant.options[dimension]}
          </button>
        ))}
      </div>
      {product.optionNames.length > 1 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {product.optionNames.slice(1).join(' + ')} selected automatically based on your pick.
        </p>
      ) : null}
    </div>
  )
}

function TrustBadge({
  icon: Icon,
  title,
  text
}: {
  icon: React.ElementType
  title: string
  text: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Icon className="size-5 shrink-0 text-primary" />
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

function ReviewsSection({
  productId,
  signedIn,
  data,
  onAdded
}: {
  productId: string
  signedIn: boolean | null
  data: ReviewsListData | null
  onAdded: () => void
}) {
  const [visible, setVisible] = useState(8)
  const items = data?.items ?? []
  return (
    <div className="space-y-6" id="reviews">
      <ReviewForm productId={productId} signedIn={signedIn} onAdded={onAdded} />
      {data && data.meta.totalItems > 0 ? (
        <div>
          {data.summary ? (
            <div className="mb-4 flex items-center gap-4">
              <span className="text-4xl font-bold tabular-nums">
                {Number(data.summary.average).toFixed(1)}
              </span>
              <div>
                <RatingStars value={data.summary.average} size="size-4" />
                <p className="mt-1 text-sm text-muted-foreground">{data.meta.totalItems} reviews</p>
              </div>
            </div>
          ) : null}
          <div className="space-y-4">
            {items.slice(0, visible).map((review) => (
              <article key={review.id} className="rounded-xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RatingStars value={review.rating} />
                    <span className="text-sm font-semibold">{review.title ?? 'Review'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {review.userName} · {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.body ? (
                  <p className="mt-2 text-sm text-muted-foreground">{review.body}</p>
                ) : null}
              </article>
            ))}
          </div>
          {visible < data.meta.totalItems ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setVisible((current) => current + 8)}
            >
              Show more reviews
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No reviews yet. Be the first to review this product after your order arrives.
        </p>
      )}
    </div>
  )
}

function ReviewForm({
  productId,
  signedIn,
  onAdded
}: {
  productId: string
  signedIn: boolean | null
  onAdded: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (rating < 1) {
      setError('Please select a star rating.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(false)
    try {
      await postJson('/catalog/reviews', {
        productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined
      })
      setRating(0)
      setTitle('')
      setBody('')
      setSuccess(true)
      onAdded()
    } catch (err) {
      setError(
        isApiError(err)
          ? err.code === 'ALREADY_REVIEWED'
            ? 'You already reviewed this product.'
            : err.message
          : 'Could not submit your review.'
      )
    } finally {
      setBusy(false)
    }
  }

  const displayRating = hoverRating || rating

  if (signedIn === false || signedIn === null) {
    return null
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Write a review</p>
        <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
              onMouseEnter={() => setHoverRating(value)}
              onClick={() => {
                setRating(value)
                setError(null)
              }}
            >
              <Star
                className={cn(
                  'size-5 transition-colors',
                  value <= displayRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <input
        className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Title (optional)"
        maxLength={120}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Share your experience with this product (optional)"
        rows={3}
        maxLength={5000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="mt-2 text-sm text-emerald-600">
          Thanks! Your review has been submitted and is now live.
        </p>
      ) : null}
      <Button type="submit" size="sm" className="mt-3" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  )
}

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
