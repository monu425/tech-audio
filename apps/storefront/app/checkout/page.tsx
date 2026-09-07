'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  Plus,
  ShoppingBag,
  Truck
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCart } from '@/components/cart-provider'
import { getJson, isApiError, postJson } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Address, AddressInput, CheckoutOptions, OrderSummary } from '@/lib/store-types'

interface PlaceOrderResult {
  order: OrderSummary
}

export default function CheckoutPage() {
  const cart = useCart()
  const [authState, setAuthState] = useState<'loading' | 'signed-in' | 'guest'>('loading')
  const [options, setOptions] = useState<CheckoutOptions | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [placed, setPlaced] = useState<OrderSummary | null>(null)
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)

  const refreshOptions = useCallback(() => {
    getJson<CheckoutOptions>('/checkout/options').then((data) => {
      setOptions(data)
      setSelectedAddressId((current) => {
        if (current && data.addresses.some((address) => address.id === current)) return current
        return (
          data.addresses.find((address) => address.isDefault)?.id ?? data.addresses[0]?.id ?? null
        )
      })
      setShippingMethodId((current) => {
        if (current && data.shippingMethods.some((method) => method.id === current)) return current
        return data.shippingMethods[0]?.id ?? null
      })
    })
  }, [])

  useEffect(() => {
    let active = true
    getJson<{ user: unknown }>('/auth/me')
      .then(() => {
        if (active) {
          setAuthState('signed-in')
          refreshOptions()
        }
      })
      .catch(() => {
        if (active) setAuthState('guest')
      })
    return () => {
      active = false
    }
  }, [refreshOptions])

  const activeCart = options?.cart ?? cart.cart

  async function placeOrder() {
    setError(null)
    setBusy(true)
    try {
      const result = await postJson<PlaceOrderResult>('/checkout/place-order', {
        addressId: selectedAddressId,
        shippingMethodId,
        paymentMethod: 'cod',
        notes: notes.trim() || null
      })
      setPlaced(result.order)
      setOptions(null)
      void cart.refresh()
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not place your order.')
      void cart.refresh()
    } finally {
      setBusy(false)
    }
  }

  const totals = activeCart?.totals
  const shippingMethod = useMemo(
    () => options?.shippingMethods.find((method) => method.id === shippingMethodId) ?? null,
    [options, shippingMethodId]
  )

  if (placed) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-9" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Order placed</h1>
        <p className="text-muted-foreground">
          Thanks for your order! Your order number is{' '}
          <span className="font-semibold text-foreground">{placed.orderNumber}</span>. A
          confirmation has been recorded and we will start preparing your items shortly.
        </p>
        <div className="w-full rounded-xl border bg-muted/50 p-5 text-left text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Payment method</span>
            <span className="font-medium">Cash on delivery</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Order total</span>
            <span className="font-medium">{formatMoney(placed.totalMinor, placed.currency)}</span>
          </div>
        </div>
        <div className="mt-2 flex gap-3">
          <Button asChild>
            <Link href={`/account/orders/${placed.id}`}>Track order</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products">Continue shopping</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (authState === 'loading') {
    return <CheckoutShell busy />
  }

  if (authState === 'guest') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <Lock className="size-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Sign in to check out</h1>
        <p className="text-sm text-muted-foreground">
          Please sign in so we can find your address book and process the order.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/login?next=/checkout">Sign in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/cart" className="hidden">
              Review cart
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!options || !activeCart || !activeCart.lines.length) {
    return <CheckoutShell />
  }

  async function createAddress(input: AddressInput) {
    setAddressError(null)
    try {
      await postJson<Address>('/addresses', input)
      setShowNewAddress(false)
      refreshOptions()
    } catch (err) {
      setAddressError(isApiError(err) ? err.message : 'Could not save the address.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Continue shopping
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Checkout</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="size-5 text-muted-foreground" />
                Shipping address
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewAddress((value) => !value)}
              >
                <Plus className="size-4" />
                {showNewAddress ? 'Cancel' : 'New address'}
              </Button>
            </div>

            {showNewAddress ? (
              <NewAddressForm onSave={(input) => void createAddress(input)} error={addressError} />
            ) : options.addresses.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                You do not have any saved addresses yet.{' '}
                <Link
                  href="/account/addresses"
                  className="font-medium text-primary hover:underline"
                >
                  Manage addresses
                </Link>
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {options.addresses.map((address) => (
                  <li key={address.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedAddressId(address.id)}
                      className={cn(
                        'w-full rounded-xl border p-4 text-left transition-colors',
                        selectedAddressId === address.id
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'hover:border-muted-foreground/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{address.fullName}</p>
                        {address.isDefault ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.city}
                        {address.state ? `, ${address.state}` : ''} {address.postalCode}
                      </p>
                      <p className="text-sm text-muted-foreground">{address.country}</p>
                      {address.phone ? (
                        <p className="mt-1 text-xs text-muted-foreground">{address.phone}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Truck className="size-5 text-muted-foreground" />
              Delivery method
            </h2>
            <ul className="space-y-3">
              {options.shippingMethods.map((method) => (
                <li key={method.id}>
                  <button
                    type="button"
                    onClick={() => setShippingMethodId(method.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors',
                      shippingMethodId === method.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'hover:border-muted-foreground/40'
                    )}
                  >
                    <div>
                      <p className="font-medium">{method.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{method.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {method.estimatedDays} ·{' '}
                        {method.priceMinor === 0 ? 'Free' : formatMoney(method.priceMinor)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-full border',
                        shippingMethodId === method.id ? 'border-primary' : 'border-input'
                      )}
                    >
                      {shippingMethodId === method.id ? (
                        <span className="size-2 rounded-full bg-primary" />
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <CreditCard className="size-5 text-muted-foreground" />
              Payment
            </h2>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-5 items-center justify-center rounded-full border border-primary">
                  <span className="size-2 rounded-full bg-primary" />
                </span>
                <div>
                  <p className="font-medium">Cash on delivery</p>
                  <p className="text-sm text-muted-foreground">
                    Pay with cash or card when your order arrives.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag className="size-5 text-muted-foreground" />
              Order notes
            </h2>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Delivery instructions or anything we should know (optional)"
              maxLength={1000}
            />
          </section>
        </div>

        <aside className="h-fit space-y-5 lg:sticky lg:top-24">
          <div className="rounded-xl border">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Order summary</h2>
            </div>
            <ul className="max-h-80 divide-y overflow-y-auto px-5">
              {activeCart.lines.map((line) => (
                <li
                  key={`${line.productId}:${line.variantId ?? 'base'}`}
                  className="flex gap-3 py-3"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {line.image ? (
                      <Image
                        src={line.image.url}
                        alt={line.image.alt ?? line.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    {line.optionSummary ? (
                      <p className="truncate text-xs text-muted-foreground">{line.optionSummary}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">Qty {line.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{formatMoney(line.lineTotalMinor)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatMoney(totals?.subtotalMinor ?? 0)}</dd>
              </div>
              {(totals?.discountMinor ?? 0) > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>
                    Discount
                    {activeCart.couponCode ? (
                      <span className="ml-1 text-xs">({activeCart.couponCode})</span>
                    ) : null}
                  </dt>
                  <dd>-{formatMoney(totals?.discountMinor ?? 0)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>
                  {shippingMethod?.priceMinor === 0
                    ? 'Free'
                    : shippingMethod
                      ? formatMoney(shippingMethod.priceMinor)
                      : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatMoney(totals?.taxMinor ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(totals?.grandTotalMinor ?? 0)}</dd>
              </div>
            </dl>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={busy || !selectedAddressId || !shippingMethodId}
            onClick={() => void placeOrder()}
          >
            <Lock className="size-4" />
            {busy ? 'Placing order…' : `Place order · ${formatMoney(totals?.grandTotalMinor ?? 0)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Cash on delivery only · No payment taken now
          </p>
        </aside>
      </div>
    </div>
  )
}

function CheckoutShell({ busy = false }: { busy?: boolean }) {
  if (busy) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-5 px-4 py-24 text-center">
      <ShoppingBag className="size-10 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Your cart is empty</h1>
      <p className="text-muted-foreground">Add a few products before heading to checkout.</p>
      <Button asChild size="lg">
        <Link href="/products">Browse products</Link>
      </Button>
    </div>
  )
}

function NewAddressForm({
  onSave,
  error
}: {
  onSave: (input: AddressInput) => void
  error: string | null
}) {
  const [form, setForm] = useState<AddressInput>({
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
    isDefault: false
  })

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <form
      className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(form)
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="co-fullName">Full name</Label>
        <Input
          id="co-fullName"
          required
          value={form.fullName}
          onChange={(event) => set('fullName', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="co-phone">Phone</Label>
        <Input
          id="co-phone"
          value={form.phone ?? ''}
          onChange={(event) => set('phone', event.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="co-line1">Address line 1</Label>
        <Input
          id="co-line1"
          required
          value={form.line1}
          onChange={(event) => set('line1', event.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="co-line2">Address line 2 (optional)</Label>
        <Input
          id="co-line2"
          value={form.line2 ?? ''}
          onChange={(event) => set('line2', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="co-city">City</Label>
        <Input
          id="co-city"
          required
          value={form.city}
          onChange={(event) => set('city', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="co-state">State / Province</Label>
        <Input
          id="co-state"
          value={form.state ?? ''}
          onChange={(event) => set('state', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="co-postalCode">Postal code</Label>
        <Input
          id="co-postalCode"
          required
          value={form.postalCode}
          onChange={(event) => set('postalCode', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="co-country">Country</Label>
        <Input
          id="co-country"
          required
          value={form.country}
          onChange={(event) => set('country', event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          className="size-4 rounded border"
          checked={form.isDefault ?? false}
          onChange={(event) => set('isDefault', event.target.checked)}
        />
        Set as my default address
      </label>
      {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit">Save address</Button>
      </div>
    </form>
  )
}
