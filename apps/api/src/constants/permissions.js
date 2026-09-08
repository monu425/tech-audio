import { UserRoles } from '@shop/types'

export const ROLES = UserRoles

export const PERMISSIONS = Object.freeze({
  DASHBOARD_READ: 'dashboard.read',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_READ: 'product.read',
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
  BANNER_MANAGE: 'banner.manage',
  ANALYTICS_READ: 'analytics.read',
  REPORT_READ: 'report.read',
  SETTINGS_MANAGE: 'settings.manage',
  ADMIN_MANAGE: 'admin.manage',
  AUDIT_READ: 'audit.read',
  PAYMENT_READ: 'payment.read',
  PAYMENT_REFUND: 'payment.refund'
})

const ALL = Object.values(PERMISSIONS)

// Role -> permission grants. Adding a role later only requires an entry here.
const ROLE_PERMISSIONS = {
  [ROLES.CUSTOMER]: [],
  [ROLES.ADMIN]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.BRAND_MANAGE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_REFUND,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.COUPON_MANAGE,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.BANNER_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_REFUND,
    PERMISSIONS.AUDIT_READ
  ],
  [ROLES.SUPER_ADMIN]: ALL
}

export const ROLE_LABELS = {
  [ROLES.CUSTOMER]: 'Customer',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin'
}

export function roleHasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? []
}

export function isAdminRole(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
}
