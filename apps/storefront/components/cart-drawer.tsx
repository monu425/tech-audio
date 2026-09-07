'use client'

import { useState } from 'react'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import Link from 'next/link'

import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isApiError } from '@/lib/api'

export function CartDrawer() {
  const cart = useCart()
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lines = cart.cart?.lines ?? []
  const totals = cart.cart?.totals
  const itemCount = cart.cart?.totals.itemsCount ?? 0

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setCouponError(null)
    try {
      await fn()
    } catch (error) {
      if (isApiError(error)) setCouponError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn('fixed inset-0 z-50', cart.isOpen ? '' : 'pointer-events-none')}
      aria-hidden={!cart.isOpen}
    >
      <button
        aria-label="Close cart"
        tabIndex={cart.isOpen ? 0 : -1}
        onClick={() => cart.setOpen(false)}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity',
          cart.isOpen ? 'opacity-100' : 'opacity-0'
        )}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl transition-transform duration-300',
          cart.isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-label="Shopping cart"
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold">
            <ShoppingBag className="size-4" />
            Your cart
            {itemCount > 0 && <span className="text-muted-foreground">({itemCount})</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => cart.setOpen(false)}
            aria-label="Close cart"
          >
            <X className="size-4" />
          </Button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Button asChild>
              <Link href="/products" onClick={() => cart.setOpen(false)}>
                Start shopping
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-5">
              {lines.map((line) => (
                <li
                  key={`${line.productId}-${line.variantId ?? 'base'}`}
                  className="flex gap-4 py-4"
                >
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.image.url}
                        alt={line.image.alt ?? line.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${line.slug}`}
                        onClick={() => cart.setOpen(false)}
                        className="line-clamp-2 text-sm font-medium hover:underline"
                      >
                        {line.name}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
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
                    {line.optionSummary ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{line.optionSummary}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-md border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={busy}
                          aria-label="Decrease quantity"
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
                          <Minus className="size-3" />
                        </Button>
                        <span className="min-w-6 text-center text-sm tabular-nums">
                          {line.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={busy || line.quantity >= line.availableStock}
                          aria-label="Increase quantity"
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
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(line.lineTotalMinor, totals?.currency)}
                      </span>
                    </div>
                    {line.availableStock < line.quantity && (
                      <p className="mt-1 text-xs text-destructive">
                        Only {line.availableStock} available
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t px-5 py-4">
              {totals ? (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">
                      {formatMoney(totals.subtotalMinor, totals.currency)}
                    </dd>
                  </div>
                  {totals.discountMinor > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <dt>{cart.cart?.couponDescription ?? 'Discount'}</dt>
                      <dd className="tabular-nums">
                        -{formatMoney(totals.discountMinor, totals.currency)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">
                      {formatMoney(totals.grandTotalMinor, totals.currency)}
                    </dd>
                  </div>
                  {totals.shippingMinor > 0 && (
                    <p className="text-xs text-muted-foreground">Shipping calculated at checkout</p>
                  )}
                </dl>
              ) : null}

              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const code = couponInput.trim()
                  if (code) void run(() => cart.applyCoupon(code).then(() => setCouponInput('')))
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
                <p className="mt-2 flex items-center justify-between text-xs text-emerald-600">
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
              {couponError ? <p className="mt-2 text-xs text-destructive">{couponError}</p> : null}

              <Button
                asChild
                className="mt-4 w-full"
                size="lg"
                disabled={busy}
                onClick={() => cart.setOpen(false)}
              >
                <Link href="/checkout">Checkout</Link>
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
