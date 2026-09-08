'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { getJson, postJson } from '@/lib/api'
import type { SessionMe } from '@/lib/admin-types'

export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard.read',
  PRODUCT_READ: 'product.read',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  CATEGORY_MANAGE: 'category.manage',
  BRAND_MANAGE: 'brand.manage',
  ORDER_READ: 'order.read',
  ORDER_UPDATE: 'order.update',
  ORDER_REFUND: 'order.refund',
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_UPDATE: 'customer.update',
  INVENTORY_MANAGE: 'inventory.manage',
  COUPON_MANAGE: 'coupon.manage',
  REVIEW_MODERATE: 'review.moderate',
  REPORT_READ: 'report.read',
  SETTINGS_MANAGE: 'settings.manage',
  ADMIN_MANAGE: 'admin.manage',
  AUDIT_READ: 'audit.read'
} as const

type SessionContextValue = {
  me: SessionMe | null
  loading: boolean
  hasPermission: (permission: string) => boolean
  signOut: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [me, setMe] = React.useState<SessionMe | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    getJson<SessionMe>('/admin/me')
      .then((data) => {
        if (alive) setMe(data)
      })
      .catch(() => {
        if (alive) setMe(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const value = React.useMemo<SessionContextValue>(() => {
    const permissions = me?.permissions ?? []
    return {
      me,
      loading,
      hasPermission: (permission) => permissions.includes(permission),
      signOut: async () => {
        try {
          await postJson('/auth/logout')
        } catch {
          // ignore network errors during logout
        }
        router.replace('/login')
      }
    }
  }, [me, loading, router])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext)
  if (!context) throw new Error('useSession must be used within SessionProvider')
  return context
}
