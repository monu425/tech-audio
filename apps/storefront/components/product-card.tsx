'use client'

import { Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductSummary } from '@/lib/store-types'

export function ProductCard({ product }: { product: ProductSummary }) {
  const onSale =
    product.discountPercent && product.discountPercent > 0
      ? { compareAtMinor: product.compareAtMinor, percent: product.discountPercent }
      : null
  const outOfStock = product.stockStatus === 'out_of_stock'

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt ?? product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {onSale ? (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
              -{onSale.percent}%
            </span>
          ) : null}
        </div>
        {outOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <span className="rounded-full border bg-background px-3 py-1 text-sm font-medium">
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand.name}
          </span>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</h3>
        {product.ratingAverage != null && product.reviewCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {Number(product.ratingAverage).toFixed(1)}
            <span>({product.reviewCount})</span>
          </span>
        ) : null}

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className={cn('text-base font-semibold', onSale ? 'text-destructive' : '')}>
            {formatMoney(product.priceMinor, product.currency)}
          </span>
          {onSale ? (
            <span className="text-sm text-muted-foreground line-through">
              {formatMoney(onSale.compareAtMinor ?? 0, product.currency)}
            </span>
          ) : null}
        </div>
        <Button
          asChild
          size="sm"
          variant={outOfStock ? 'outline' : 'secondary'}
          className="mt-3 w-full"
          disabled={outOfStock}
        >
          <Link href={`/products/${product.slug}`}>
            {outOfStock ? 'View product' : 'View options'}
          </Link>
        </Button>
      </div>
    </Link>
  )
}
