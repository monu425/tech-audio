'use client'

import { useState } from 'react'
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { isApiError } from '@/lib/api'
import { formatMoney } from '@/lib/format'

export default function CartPage() {
  const cart = useCart()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState('')

  const lines = cart.cart?.lines ?? []
  const totals = cart.cart?.totals
  const itemCount = cart.cart?.totals.itemsCount ?? 0
  const currency = totals?.currency ?? 'USD'

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not update your cart.')
    } finally {
      setBusy(false)
    }
  }

  if (!cart.cart) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-48" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your cart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {itemCount > 0
              ? `${itemCount} item${itemCount === 1 ? '' : 's'} in your cart`
              : 'Your cart is empty'}
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Continue shopping
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingBag className="size-6" />
          </span>
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button asChild size="lg">
            <Link href="/products">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <ul className="divide-y rounded-xl border">
            {lines.map((line) => (
              <li
                key={`${line.productId}-${line.variantId ?? 'base'}`}
                className="flex gap-4 p-4 sm:p-5"
              >
                <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border bg-muted sm:w-24">
                  {line.image ? (
                    <Image
                      src={line.image.url}
                      alt={line.image.alt ?? line.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${line.slug}`}
                        className="line-clamp-2 font-medium hover:underline"
                      >
                        {line.name}
                      </Link>
                      {line.optionSummary ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{line.optionSummary}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {line.sku ? `SKU: ${line.sku}` : ''}
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        <span className="text-foreground">
                          {formatMoney(line.unitPriceMinor, currency)}
                        </span>
                        {line.compareAtMinor && line.compareAtMinor > line.unitPriceMinor ? (
                          <>
                            {' '}
                            <span className="line-through opacity-70">
                              {formatMoney(line.compareAtMinor, currency)}
                            </span>
                          </>
                        ) : null}
                        {line.discountPercent ? (
                          <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                            -{line.discountPercent}%
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label="Remove item"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          cart.removeItem({
                            productId: line.productId,
                            variantId: line.variantId
                          })
                        )
                      }
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="flex items-center rounded-lg border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label="Decrease quantity"
                        disabled={busy}
                        onClick={() => {
                          const next = line.quantity - 1
                          if (next <= 0) {
                            void run(() =>
                              cart.removeItem({
                                productId: line.productId,
                                variantId: line.variantId
                              })
                            )
                          } else {
                            void run(() =>
                              cart.updateItem({
                                productId: line.productId,
                                variantId: line.variantId,
                                quantity: next
                              })
                            )
                          }
                        }}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="min-w-10 text-center text-sm font-medium tabular-nums">
                        {line.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label="Increase quantity"
                        disabled={busy || line.quantity >= line.availableStock}
                        onClick={() =>
                          void run(() =>
                            cart.updateItem({
                              productId: line.productId,
                              variantId: line.variantId,
                              quantity: line.quantity + 1
                            })
                          )
                        }
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {formatMoney(line.lineTotalMinor, currency)}
                      </p>
                      {line.availableStock < line.quantity ? (
                        <p className="text-xs text-destructive">
                          Only {line.availableStock} available
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(line.unitPriceMinor, currency)} each
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit space-y-5 lg:sticky lg:top-24">
            <div className="rounded-xl border">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Order summary</h2>
              </div>
              <dl className="space-y-2 px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatMoney(totals?.subtotalMinor ?? 0, currency)}
                  </dd>
                </div>
                {(totals?.discountMinor ?? 0) > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <dt>{cart.cart?.couponDescription ?? 'Discount'}</dt>
                    <dd className="tabular-nums">
                      -{formatMoney(totals?.discountMinor ?? 0, currency)}
                    </dd>
                  </div>
                ) : null}
                {(totals?.taxMinor ?? 0) > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd className="tabular-nums">{formatMoney(totals?.taxMinor ?? 0, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-3 text-base font-semibold">
                  <dt>Order total</dt>
                  <dd className="tabular-nums">
                    {formatMoney(totals?.grandTotalMinor ?? 0, currency)}
                  </dd>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Shipping calculated at checkout
                </p>
              </dl>

              <form
                className="flex gap-2 border-t px-5 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  const code = couponInput.trim()
                  if (code) {
                    void run(() => cart.applyCoupon(code).then(() => setCouponInput('')))
                  }
                }}
              >
                <Input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  className="uppercase"
                  disabled={busy}
                />
                <Button type="submit" variant="outline" disabled={busy || !couponInput.trim()}>
                  Apply
                </Button>
              </form>
              {cart.cart?.couponCode ? (
                <p className="flex items-center justify-between gap-2 px-5 pb-4 text-xs text-emerald-600">
                  <span>
                    {cart.cart.couponCode} applied
                    {cart.cart.couponDescription ? ` — ${cart.cart.couponDescription}` : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={busy}
                    onClick={() => void run(() => cart.removeCoupon())}
                  >
                    Remove
                  </Button>
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <Button asChild size="lg" className="w-full" disabled={busy}>
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  )
}
