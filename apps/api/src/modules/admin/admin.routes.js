import { Router } from 'express'

import * as admin from './admin.controller.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  requireAuth,
  requireAdmin,
  requirePermission,
  requireSuperAdmin
} from '../../middlewares/auth.js'
import { validateBody, validateQuery, validateParams } from '../../middlewares/validate.js'
import {
  idParamSchema,
  listProductsQuery,
  productPayload,
  inventoryAdjustPayload,
  brandPayload,
  categoryPayload,
  couponPayload,
  couponPatchPayload,
  orderTransitionPayload,
  paymentStatusPayload,
  listOrdersQuery,
  listCustomersQuery,
  paginationQuery,
  customerStatusPayload,
  roleChangePayload,
  staffCreatePayload,
  reviewModerationPayload,
  settingsPayload,
  salesReportQuery,
  topProductsQuery
} from './admin.schemas.js'
import { z } from 'zod'

const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin())

adminRouter.get('/me', admin.getMe)

const couponsListQuery = paginationQuery(20, {
  statusFilter: z.enum(['all', 'active', 'inactive', 'expired']).optional().default('all')
})
const reviewsListQuery = paginationQuery(20, {
  status: z.enum(['pending', 'approved', 'rejected']).optional()
})

adminRouter.get('/dashboard', requirePermission(PERMISSIONS.DASHBOARD_READ), admin.getDashboard)

adminRouter.get('/roles', requirePermission(PERMISSIONS.ADMIN_MANAGE), admin.getRoles)

adminRouter.get('/settings', admin.getSettings)
adminRouter.patch(
  '/settings',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validateBody(settingsPayload),
  admin.updateSettings
)

adminRouter.get(
  '/products/meta',
  requirePermission(PERMISSIONS.PRODUCT_READ),
  admin.getProductFormMeta
)
adminRouter.get(
  '/products',
  requirePermission(PERMISSIONS.PRODUCT_READ),
  validateQuery(listProductsQuery),
  admin.listProducts
)
adminRouter.post(
  '/products',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  validateBody(productPayload),
  admin.createProduct
)
adminRouter.get(
  '/products/:id/inventory',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validateParams(idParamSchema),
  admin.getProductInventory
)
adminRouter.post(
  '/products/:id/inventory/adjust',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validateParams(idParamSchema),
  validateBody(inventoryAdjustPayload),
  admin.adjustProductInventory
)
adminRouter.get(
  '/products/:id',
  requirePermission(PERMISSIONS.PRODUCT_READ),
  validateParams(idParamSchema),
  admin.getProduct
)
adminRouter.patch(
  '/products/:id',
  requirePermission(PERMISSIONS.PRODUCT_UPDATE),
  validateParams(idParamSchema),
  validateBody(productPayload.partial()),
  admin.updateProduct
)
adminRouter.post(
  '/products/:id/archive',
  requirePermission(PERMISSIONS.PRODUCT_DELETE),
  validateParams(idParamSchema),
  admin.archiveProduct
)

adminRouter.get('/brands', requirePermission(PERMISSIONS.BRAND_MANAGE), admin.listBrands)
adminRouter.post(
  '/brands',
  requirePermission(PERMISSIONS.BRAND_MANAGE),
  validateBody(brandPayload),
  admin.createBrand
)
adminRouter.patch(
  '/brands/:id',
  requirePermission(PERMISSIONS.BRAND_MANAGE),
  validateParams(idParamSchema),
  validateBody(brandPayload.partial()),
  admin.updateBrand
)
adminRouter.post(
  '/brands/:id/archive',
  requirePermission(PERMISSIONS.BRAND_MANAGE),
  validateParams(idParamSchema),
  admin.archiveBrand
)

adminRouter.get('/categories', requirePermission(PERMISSIONS.CATEGORY_MANAGE), admin.listCategories)
adminRouter.post(
  '/categories',
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validateBody(categoryPayload),
  admin.createCategory
)
adminRouter.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validateParams(idParamSchema),
  validateBody(categoryPayload.partial()),
  admin.updateCategory
)
adminRouter.post(
  '/categories/:id/archive',
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validateParams(idParamSchema),
  admin.archiveCategory
)

adminRouter.get(
  '/orders',
  requirePermission(PERMISSIONS.ORDER_READ),
  validateQuery(listOrdersQuery),
  admin.listOrders
)
adminRouter.get(
  '/orders/:id',
  requirePermission(PERMISSIONS.ORDER_READ),
  validateParams(idParamSchema),
  admin.getOrder
)
adminRouter.post(
  '/orders/:id/transition',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validateParams(idParamSchema),
  validateBody(orderTransitionPayload),
  admin.transitionOrder
)
adminRouter.post(
  '/orders/:id/payment',
  requirePermission(PERMISSIONS.ORDER_REFUND),
  validateParams(idParamSchema),
  validateBody(paymentStatusPayload),
  admin.setPaymentStatus
)

adminRouter.get(
  '/customers',
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  validateQuery(listCustomersQuery),
  admin.listCustomers
)
adminRouter.get(
  '/customers/:id',
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  validateParams(idParamSchema),
  admin.getCustomer
)
adminRouter.patch(
  '/customers/:id/status',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validateParams(idParamSchema),
  validateBody(customerStatusPayload),
  admin.updateCustomerStatus
)

adminRouter.get(
  '/staff',
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  validateQuery(paginationQuery(20)),
  admin.listStaff
)
adminRouter.post('/staff', requireSuperAdmin(), validateBody(staffCreatePayload), admin.createStaff)
adminRouter.patch(
  '/staff/:id/status',
  requireSuperAdmin(),
  validateParams(idParamSchema),
  validateBody(customerStatusPayload),
  admin.updateStaffStatus
)
adminRouter.patch(
  '/staff/:id/role',
  requireSuperAdmin(),
  validateParams(idParamSchema),
  validateBody(roleChangePayload),
  admin.changeStaffRole
)

adminRouter.get(
  '/coupons',
  requirePermission(PERMISSIONS.COUPON_MANAGE),
  validateQuery(couponsListQuery),
  admin.listCoupons
)
adminRouter.post(
  '/coupons',
  requirePermission(PERMISSIONS.COUPON_MANAGE),
  validateBody(couponPayload),
  admin.createCoupon
)
adminRouter.get(
  '/coupons/:id',
  requirePermission(PERMISSIONS.COUPON_MANAGE),
  validateParams(idParamSchema),
  admin.getCoupon
)
adminRouter.patch(
  '/coupons/:id',
  requirePermission(PERMISSIONS.COUPON_MANAGE),
  validateParams(idParamSchema),
  validateBody(couponPatchPayload),
  admin.updateCoupon
)
adminRouter.post(
  '/coupons/:id/toggle',
  requirePermission(PERMISSIONS.COUPON_MANAGE),
  validateParams(idParamSchema),
  admin.toggleCoupon
)

adminRouter.get(
  '/reviews',
  requirePermission(PERMISSIONS.REVIEW_MODERATE),
  validateQuery(reviewsListQuery),
  admin.listReviews
)
adminRouter.post(
  '/reviews/:id/moderate',
  requirePermission(PERMISSIONS.REVIEW_MODERATE),
  validateParams(idParamSchema),
  validateBody(reviewModerationPayload),
  admin.moderateReview
)
adminRouter.post(
  '/reviews/:id/reject',
  requirePermission(PERMISSIONS.REVIEW_MODERATE),
  validateParams(idParamSchema),
  admin.rejectReview
)

adminRouter.get(
  '/reports/sales',
  requirePermission(PERMISSIONS.REPORT_READ),
  validateQuery(salesReportQuery),
  admin.getSalesReport
)
adminRouter.get(
  '/reports/top-products',
  requirePermission(PERMISSIONS.REPORT_READ),
  validateQuery(topProductsQuery),
  admin.getTopProducts
)

export default adminRouter
