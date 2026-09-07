'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

import { getJson, postJson, deleteJson, patchJson } from '@/lib/api'
import type { CartDto } from '@/lib/store-types'

interface CartContextValue {
  cart: CartDto | null
  loading: boolean
  error: string | null
  isOpen: boolean
  setOpen: (open: boolean) => void
  refresh: () => Promise<void>
  addItem: (input: {
    productId: string
    variantId: string | null
    quantity: number
  }) => Promise<void>
  updateItem: (input: {
    productId: string
    variantId: string | null
    quantity: number
  }) => Promise<void>
  removeItem: (input: { productId: string; variantId: string | null }) => Promise<void>
  clearCart: () => Promise<void>
  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setOpen] = useState(false)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const data = await getJson<CartDto>('/cart')
      setCart(data)
      setError(null)
    } catch {
      setCart((current) => current ?? emptyCart())
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    inFlight.current = true
    getJson<CartDto>('/cart')
      .then((data) => {
        if (!active) return
        setCart(data)
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setCart((current) => current ?? emptyCart())
      })
      .finally(() => {
        if (active) {
          inFlight.current = false
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const runMutation = useCallback(async (action: () => Promise<CartDto>) => {
    const data = await action()
    setCart(data)
    return data
  }, [])

  const addItem = useCallback(
    async (input: { productId: string; variantId: string | null; quantity: number }) => {
      await runMutation(() => postJson<CartDto>('/cart/items', input))
      setError(null)
    },
    [runMutation]
  )

  const updateItem = useCallback(
    async (input: { productId: string; variantId: string | null; quantity: number }) => {
      await runMutation(() => patchJson<CartDto>('/cart/items', input))
    },
    [runMutation]
  )

  const removeItem = useCallback(
    async (input: { productId: string; variantId: string | null }) => {
      await runMutation(() => deleteJson<CartDto>('/cart/items', input))
    },
    [runMutation]
  )

  const clearCart = useCallback(async () => {
    await runMutation(() => deleteJson<CartDto>('/cart'))
  }, [runMutation])

  const applyCoupon = useCallback(
    async (code: string) => {
      await runMutation(() => postJson<CartDto>('/cart/coupon', { code }))
    },
    [runMutation]
  )

  const removeCoupon = useCallback(async () => {
    await runMutation(() => deleteJson<CartDto>('/cart/coupon'))
  }, [runMutation])

  const value = useMemo(
    () => ({
      cart,
      loading,
      error,
      isOpen,
      setOpen,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon
    }),
    [
      cart,
      loading,
      error,
      isOpen,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

function emptyCart(): CartDto {
  return {
    id: null,
    lines: [],
    totals: {
      itemsCount: 0,
      subtotalMinor: 0,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 0,
      currency: 'USD'
    },
    couponCode: null,
    couponDescription: null
  }
}
