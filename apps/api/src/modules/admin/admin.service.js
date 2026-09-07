import { OrderStatuses, OrderPaymentStatuses, UserRoles, UserStatuses } from '@shop/types'
import Order from '../orders/order.model.js'
import User, { toPublicUser } from '../auth/user.model.js'
import Address from '../address/address.model.js'
import Review from '../reviews/review.model.js'
import Coupon from '../coupon/coupon.model.js'
import { releaseReservation, escapeRegex } from '../inventory/stock.service.js'
import Product from '../catalog/product.model.js'
import { BadRequestError, NotFoundError } from '../../utils/errors.js'
import { permissionsForRole, ROLE_LABELS } from '../../constants/permissions.js'
import {
  getPlatformSettings,
  updatePlatformSettings,
  getStoreInfo
} from '../../config/platformConfig.js'
import { listShippingMethods } from '../orders/shipping.js'
import { createLogger } from '../../config/logger.js'
import { sendOrderStatusUpdate, sendOrderPaymentUpdate } from '../../services/mailer.service.js'

const mailLogger = createLogger('admin-mail')

function notify(promise) {
  promise.catch((error) => {
    mailLogger.warn({ err: error.message }, 'order notification email failed')
  })
}

function customerLabel(user) {
  return user?.name || user?.email || 'there'
}

const REVENUE_EXCLUDED = new Set([
  OrderStatuses.CANCELLED,
  OrderStatuses.RETURNED,
  OrderStatuses.REFUNDED
])

function isoUtc(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function escapeRegExp(text) {
  return escapeRegex(text)
}

async function loadUserMap(userIds) {
  const users = await User.find({ _id: { $in: [...new Set(userIds.map((id) => id?.toString()))] } })
    .select('name email role status')
    .lean()
  return new Map(users.map((user) => [user._id.toString(), user]))
}

function toOrderAdminDto(order, user) {
  const doc = order.toObject ? order.toObject() : order
  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    paymentMethod: doc.paymentMethod,
    currency: doc.currency,
    customer: user
      ? { id: user._id.toString(), name: user.name, email: user.email }
      : { id: doc.user?.toString() ?? null, name: null, email: doc.email ?? null },
    itemsCount: doc.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalMinor: doc.subtotalMinor,
    discountMinor: doc.discountMinor,
    shippingMinor: doc.shippingMinor,
    taxMinor: doc.taxMinor,
    totalMinor: doc.totalMinor,
    shippingMethod: doc.shippingMethod,
    couponCode: doc.couponCode,
    createdAt: isoUtc(doc.createdAt),
    updatedAt: isoUtc(doc.updatedAt),
    timeline: doc.timeline ?? []
  }
}

export async function getAdminMe(user) {
  return {
    user: toPublicUser(user),
    permissions: permissionsForRole(user.role),
    roleLabel: ROLE_LABELS[user.role] ?? user.role
  }
}

export async function listOrders(query) {
  const { page, pageSize, q, status, paymentStatus, from, to } = query
  const filter = {}
  if (status) filter.status = status
  if (paymentStatus) filter.paymentStatus = paymentStatus
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = from
    if (to) filter.createdAt.$lte = to
  }
  if (q) {
    const needle = escapeRegExp(q.trim())
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: needle, $options: 'i' } },
        { email: { $regex: needle, $options: 'i' } }
      ]
    })
      .select('_id')
      .lean()
    const userIds = matchingUsers.map((user) => user._id)
    filter.$or = [
      { orderNumber: { $regex: needle, $options: 'i' } },
      { 'shippingAddress.fullName': { $regex: needle, $options: 'i' } },
      { email: { $regex: needle, $options: 'i' } }
    ]
    if (userIds.length > 0) filter.$or.push({ user: { $in: userIds } })
  }

  const [orders, totalItems] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Order.countDocuments(filter)
  ])
  const userMap = await loadUserMap(orders.map((order) => order.user))

  return {
    items: orders.map((order) =>
      toOrderAdminDto(order, userMap.get(order.user.toString()) ?? null)
    ),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
  }
}

export async function getOrderDetail(orderId) {
  const order = await Order.findById(orderId)
  if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND')
  const user = await User.findById(order.user).select('name email role status').lean()
  const doc = order.toObject()
  return {
    ...toOrderAdminDto(order, user),
    items: doc.items.map((item) => ({
      ...item,
      id: item._id?.toString() ?? null,
      productId: item.productId.toString(),
      variantId: item.variantId?.toString() ?? null
    })),
    notes: doc.notes,
    shippingAddress: doc.shippingAddress,
    billingAddress: doc.billingAddress,
    customer: user
      ? { id: user._id.toString(), name: user.name, email: user.email, role: user.role }
      : null
  }
}

const ORDER_TRANSITIONS = {
  [OrderStatuses.PENDING]: [OrderStatuses.CONFIRMED, OrderStatuses.CANCELLED],
  [OrderStatuses.CONFIRMED]: [OrderStatuses.PROCESSING, OrderStatuses.CANCELLED],
  [OrderStatuses.PROCESSING]: [OrderStatuses.PACKED, OrderStatuses.CANCELLED],
  [OrderStatuses.PACKED]: [OrderStatuses.SHIPPED],
  [OrderStatuses.SHIPPED]: [OrderStatuses.OUT_FOR_DELIVERY],
  [OrderStatuses.OUT_FOR_DELIVERY]: [OrderStatuses.DELIVERED],
  [OrderStatuses.DELIVERED]: [],
  [OrderStatuses.CANCELLED]: [],
  [OrderStatuses.RETURN_REQUESTED]: [OrderStatuses.RETURNED, OrderStatuses.REFUNDED],
  [OrderStatuses.RETURNED]: [],
  [OrderStatuses.REFUNDED]: []
}

export async function transitionOrder(orderId, payload, actor) {
  const order = await Order.findById(orderId)
  if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND')

  const allowed = ORDER_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(payload.status)) {
    throw new BadRequestError(
      `Cannot move order from ${order.status} to ${payload.status}`,
      'INVALID_ORDER_TRANSITION'
    )
  }

  const note = payload.note?.trim() || `Status changed to ${payload.status}`
  if (payload.status === OrderStatuses.CANCELLED) {
    order.status = OrderStatuses.CANCELLED
    order.cancelledAt = new Date()
    if (order.paymentStatus === OrderPaymentStatuses.PAID) {
      order.paymentStatus = OrderPaymentStatuses.REFUNDED
    }
    order.timeline.push({ status: OrderStatuses.CANCELLED, note, at: new Date() })
    await order.save()
    for (const item of order.items) {
      await releaseReservation(
        item.productId,
        item.variantId,
        item.quantity,
        { type: 'order', id: order.orderNumber },
        actor._id
      )
    }
    const user = await User.findById(order.user).select('name email').lean()
    if (user?.email) {
      notify(
        sendOrderStatusUpdate({
          to: user.email,
          name: customerLabel(user),
          orderNumber: order.orderNumber,
          status: OrderStatuses.CANCELLED,
          note
        })
      )
    }
    return toOrderAdminDto(order, user)
  }

  order.status = payload.status
  if (payload.status === OrderStatuses.DELIVERED) {
    if (order.paymentStatus === OrderPaymentStatuses.PENDING && order.paymentMethod === 'cod') {
      order.paymentStatus = OrderPaymentStatuses.PAID
      order.paidAt = new Date()
    }
  }
  if (payload.paymentStatus && payload.paymentStatus !== order.paymentStatus) {
    order.paymentStatus = payload.paymentStatus
    if (payload.paymentStatus === OrderPaymentStatuses.PAID) order.paidAt = new Date()
  }
  order.timeline.push({ status: payload.status, note, at: new Date() })
  await order.save()
  const user = await User.findById(order.user).select('name email').lean()
  if (user?.email) {
    notify(
      sendOrderStatusUpdate({
        to: user.email,
        name: customerLabel(user),
        orderNumber: order.orderNumber,
        status: payload.status,
        note
      })
    )
  }
  return toOrderAdminDto(order, user)
}

export async function setOrderPaymentStatus(orderId, payload, _actor) {
  const order = await Order.findById(orderId)
  if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND')
  if (
    order.status === OrderStatuses.CANCELLED &&
    payload.paymentStatus !== OrderPaymentStatuses.REFUNDED
  ) {
    throw new BadRequestError(
      'Cancelled orders can only be marked refunded',
      'INVALID_PAYMENT_STATUS'
    )
  }
  const wasPending = order.paymentStatus === OrderPaymentStatuses.PENDING
  order.paymentStatus = payload.paymentStatus
  if (payload.paymentStatus === OrderPaymentStatuses.PAID) order.paidAt = new Date()
  order.timeline.push({
    status: order.status,
    note:
      payload.note?.trim() ||
      `Payment status changed from ${wasPending ? 'pending' : 'previous'} to ${payload.paymentStatus}`,
    at: new Date()
  })
  await order.save()
  const user = await User.findById(order.user).select('name email').lean()
  if (user?.email) {
    const note = payload.note?.trim()
    notify(
      sendOrderPaymentUpdate({
        to: user.email,
        name: customerLabel(user),
        orderNumber: order.orderNumber,
        paymentStatus: payload.paymentStatus,
        amountMinor: order.totalMinor,
        currency: order.currency,
        note
      })
    )
  }
  return toOrderAdminDto(order, user)
}

export async function listCustomers(query) {
  const { page, pageSize, q, status } = query
  const filter = { role: { $in: [UserRoles.CUSTOMER] } }
  if (status) filter.status = status
  if (q) {
    const needle = escapeRegExp(q.trim())
    filter.$or = [
      { name: { $regex: needle, $options: 'i' } },
      { email: { $regex: needle, $options: 'i' } }
    ]
  }
  const [users, totalItems, orderStats] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter),
    Order.aggregate([
      { $match: { status: { $nin: [...REVENUE_EXCLUDED] } } },
      { $group: { _id: '$user', orders: { $sum: 1 }, totalSpentMinor: { $sum: '$totalMinor' } } }
    ])
  ])
  const statsById = new Map(orderStats.map((row) => [row._id.toString(), row]))

  return {
    items: users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      status: user.status,
      avatarUrl: user.avatarUrl,
      lastLoginAt: isoUtc(user.lastLoginAt),
      createdAt: isoUtc(user.createdAt),
      orderCount: statsById.get(user._id.toString())?.orders ?? 0,
      totalSpentMinor: statsById.get(user._id.toString())?.totalSpentMinor ?? 0
    })),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
  }
}

export async function getCustomerDetail(customerId) {
  const user = await User.findById(customerId).lean()
  if (!user) throw new NotFoundError('Customer not found', 'CUSTOMER_NOT_FOUND')
  const [addresses, recentOrders] = await Promise.all([
    Address.find({ user: customerId }).sort({ isDefault: -1, createdAt: -1 }).lean(),
    Order.find({ user: customerId }).sort({ createdAt: -1 }).limit(10).lean()
  ])
  const customerOrders = await Order.countDocuments({ user: customerId })
  return {
    customer: {
      ...toPublicUser(user),
      lastLoginAt: isoUtc(user.lastLoginAt),
      addresses: addresses.map((address) => ({
        id: address._id.toString(),
        label: address.label,
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        state: address.state ?? null,
        postalCode: address.postalCode,
        country: address.country,
        phone: address.phone ?? null,
        isDefault: address.isDefault,
        createdAt: isoUtc(address.createdAt)
      }))
    },
    orders: {
      items: recentOrders.map((order) => toOrderAdminDto(order, user)),
      meta: { totalItems: customerOrders }
    }
  }
}

export async function updateCustomerStatus(customerId, payload, actor) {
  if (customerId === actor._id.toString()) {
    throw new BadRequestError('You cannot change your own status', 'SELF_UPDATE_NOT_ALLOWED')
  }
  const user = await User.findById(customerId)
  if (!user) throw new NotFoundError('Customer not found', 'CUSTOMER_NOT_FOUND')
  if (!Object.values(UserStatuses).includes(payload.status)) {
    throw new BadRequestError('Invalid status', 'INVALID_STATUS')
  }
  user.status = payload.status
  if (user.status === UserStatuses.ACTIVE) user.lockedUntil = null
  await user.save()
  return toPublicUser(user)
}

export async function listStaff(query) {
  const { page, pageSize, q } = query
  const filter = { role: { $in: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN] } }
  if (q) {
    const needle = escapeRegExp(q.trim())
    filter.$or = [
      { name: { $regex: needle, $options: 'i' } },
      { email: { $regex: needle, $options: 'i' } }
    ]
  }
  const [users, totalItems] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter)
  ])
  return {
    items: users.map((user) => ({
      ...toPublicUser(user),
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
      lastLoginAt: isoUtc(user.lastLoginAt)
    })),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
  }
}

export async function createStaffMember(data, _actor) {
  const existing = await User.findOne({ email: data.email.toLowerCase() }).lean()
  if (existing) throw new BadRequestError('A user with this email already exists', 'EMAIL_TAKEN')
  const { hashPassword } = await import('../../services/security.service.js')
  const passwordHash = await hashPassword(data.password)
  const user = await User.create({
    name: data.name.trim(),
    email: data.email.toLowerCase(),
    passwordHash,
    role: data.role,
    status: UserStatuses.ACTIVE,
    emailVerifiedAt: new Date()
  })
  return toPublicUser(user)
}

export async function updateStaffStatus(staffId, payload, actor) {
  if (staffId === actor._id.toString()) {
    throw new BadRequestError('You cannot change your own status', 'SELF_UPDATE_NOT_ALLOWED')
  }
  const user = await User.findById(staffId)
  if (!user) throw new NotFoundError('Staff member not found', 'STAFF_NOT_FOUND')
  if (user.role === UserRoles.CUSTOMER) {
    throw new BadRequestError('User is not a staff member', 'NOT_A_STAFF_MEMBER')
  }
  user.status = payload.status
  if (user.status === UserStatuses.ACTIVE) user.lockedUntil = null
  await user.save()
  return toPublicUser(user)
}

export async function changeUserRole(userId, payload, actor) {
  if (userId === actor._id.toString()) {
    throw new BadRequestError('You cannot change your own role', 'SELF_UPDATE_NOT_ALLOWED')
  }
  const user = await User.findById(userId)
  if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND')
  user.role = payload.role
  await user.save()
  return toPublicUser(user)
}

export function getRolesInfo() {
  return {
    roles: [UserRoles.CUSTOMER, UserRoles.ADMIN, UserRoles.SUPER_ADMIN].map((role) => ({
      role,
      label: ROLE_LABELS[role] ?? role,
      permissions: permissionsForRole(role)
    })),
    roleLabels: ROLE_LABELS
  }
}

export async function getSettingsView() {
  const settings = await getPlatformSettings()
  const store = getStoreInfo()
  return {
    store: {
      storeName: settings.storeName ?? store.storeName,
      storeEmail: settings.storeEmail ?? store.storeEmail
    },
    taxRatePercent: settings.taxRatePercent,
    currency: 'USD',
    shippingMethods: listShippingMethods().map((method) => ({
      id: method.id,
      name: method.name,
      description: method.description,
      estimatedDays: method.estimatedDays
    }))
  }
}

export async function updateSettings(payload) {
  await updatePlatformSettings(payload)
  return getSettingsView()
}

export async function getDashboardData() {
  const now = new Date()
  const daysAgo = (days) => new Date(now.getTime() - days * 86400000)

  const [
    productTotal,
    productPublished,
    customerTotal,
    customerNew,
    reviewsPending,
    couponsActive
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ status: 'published' }),
    User.countDocuments({ role: UserRoles.CUSTOMER }),
    User.countDocuments({ role: UserRoles.CUSTOMER, createdAt: { $gte: daysAgo(30) } }),
    Review.countDocuments({ status: 'pending' }),
    Coupon.countDocuments({
      enabled: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    })
  ])

  const excludedStatuses = [...REVENUE_EXCLUDED]
  const recentOrders = await Order.find({ createdAt: { $gte: daysAgo(14) } }).lean()
  const revenueSeries = buildDateSeries(recentOrders, daysAgo(13), now)

  const orderStatusRows = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ])

  const revenueAgg = await Order.aggregate([
    { $match: { status: { $nin: excludedStatuses } } },
    { $group: { _id: null, revenueMinor: { $sum: '$totalMinor' }, orders: { $sum: 1 } } }
  ])

  const topProducts = await Order.aggregate([
    { $match: { status: { $nin: excludedStatuses }, createdAt: { $gte: daysAgo(30) } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        units: { $sum: '$items.quantity' },
        revenueMinor: { $sum: '$items.lineTotalMinor' }
      }
    },
    { $sort: { units: -1 } },
    { $limit: 5 }
  ])
  const products = await Product.find({ _id: { $in: topProducts.map((row) => row._id) } })
    .select('name images slug')
    .lean()
  const productMap = new Map(products.map((product) => [product._id.toString(), product]))

  const recentOrderDocs = await Order.find().sort({ createdAt: -1 }).limit(6).lean()
  const recentUsers = await loadUserMap(recentOrderDocs.map((order) => order.user))

  const lowStock = await listLowStockItems()

  return {
    counts: {
      products: productTotal,
      productsPublished: productPublished,
      customers: customerTotal,
      customersNew30d: customerNew,
      reviewsPending,
      couponsActive,
      orders: revenueAgg[0]?.orders ?? 0,
      revenueMinor: revenueAgg[0]?.revenueMinor ?? 0
    },
    revenueSeries,
    ordersByStatus: orderStatusRows.map((row) => ({ status: row._id, count: row.count })),
    topProducts: topProducts.map((row) => {
      const product = productMap.get(row._id.toString())
      return {
        productId: row._id.toString(),
        name: product?.name ?? 'Deleted product',
        imageUrl: product?.images?.[0]?.url ?? null,
        slug: product?.slug ?? null,
        units: row.units,
        revenueMinor: row.revenueMinor
      }
    }),
    recentOrders: recentOrderDocs.map((order) =>
      toOrderAdminDto(order, recentUsers.get(order.user.toString()) ?? null)
    ),
    lowStockItems: lowStock.items
  }
}

export async function listLowStockItems(limit = 8) {
  const products = await Product.find({ status: 'published' }).lean()
  const items = products
    .map((product) => {
      const activeVariants = (product.variants ?? []).filter((variant) => variant.active)
      const available =
        activeVariants.length > 0
          ? activeVariants.reduce(
              (sum, variant) => sum + Math.max(0, variant.stock - (variant.reserved ?? 0)),
              0
            )
          : Math.max(0, product.stock - (product.reserved ?? 0))
      return {
        id: product._id.toString(),
        name: product.name,
        sku: product.sku,
        imageUrl: product.images?.[0]?.url ?? null,
        available,
        threshold: product.lowStockThreshold ?? 5,
        variantsCount: activeVariants.length
      }
    })
    .filter((item) => item.available <= item.threshold)
    .sort((a, b) => a.available - b.available)
    .slice(0, limit)
  return { items, total: items.length }
}

function buildDateSeries(orders, start, end) {
  const buckets = new Map()
  const current = new Date(start)
  while (current <= end) {
    const key = current.toISOString().slice(0, 10)
    buckets.set(key, { date: key, revenueMinor: 0, orders: 0 })
    current.setUTCDate(current.getUTCDate() + 1)
  }
  for (const order of orders) {
    if (REVENUE_EXCLUDED.has(order.status)) continue
    const key = new Date(order.createdAt).toISOString().slice(0, 10)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.revenueMinor += order.totalMinor
      bucket.orders += 1
    }
  }
  return [...buckets.values()]
}

function bucketKeyFor(date, groupBy) {
  const d = new Date(date)
  if (groupBy === 'month')
    return { key: d.toISOString().slice(0, 7), label: d.toISOString().slice(0, 7) }
  if (groupBy === 'week') {
    const iso = d.toISOString()
    const day = new Date(iso.slice(0, 10) + 'T00:00:00.000Z')
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
    return { key: day.toISOString().slice(0, 10), label: day.toISOString().slice(0, 10) }
  }
  return { key: d.toISOString().slice(0, 10), label: d.toISOString().slice(0, 10) }
}

export async function getSalesReport({ from, to, groupBy = 'day' }) {
  const now = new Date()
  const start = from ? new Date(from) : new Date(now.getTime() - 30 * 86400000)
  const end = to ? new Date(to) : now
  if (start > end) throw new BadRequestError('from must be before to', 'INVALID_DATE_RANGE')

  const match = {
    createdAt: { $gte: start, $lte: end },
    status: { $nin: [...REVENUE_EXCLUDED] }
  }
  const orders = await Order.find(match).lean()

  const buckets = new Map()
  const summary = { revenueMinor: 0, orders: 0, itemsSold: 0 }
  for (const order of orders) {
    const { key, label } = bucketKeyFor(order.createdAt, groupBy)
    if (!buckets.has(key)) buckets.set(key, { key, label, revenueMinor: 0, orders: 0 })
    const bucket = buckets.get(key)
    bucket.revenueMinor += order.totalMinor
    bucket.orders += 1
    summary.revenueMinor += order.totalMinor
    summary.orders += 1
    summary.itemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0)
  }

  const series = [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
  const todaySeries = series[series.length - 1]?.orders
  const avgOrderMinor = summary.orders ? Math.round(summary.revenueMinor / summary.orders) : 0
  const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()))
  const prevMatch = {
    createdAt: { $gte: prevStart, $lt: start },
    status: { $nin: [...REVENUE_EXCLUDED] }
  }
  const prevAgg = await Order.aggregate([
    { $match: prevMatch },
    { $group: { _id: null, revenueMinor: { $sum: '$totalMinor' }, orders: { $sum: 1 } } }
  ])
  const previous = prevAgg[0]?.revenueMinor ?? 0
  const revenueChange =
    previous > 0 ? Math.round(((summary.revenueMinor - previous) / previous) * 1000) / 10 : null

  return {
    summary: {
      ...summary,
      avgOrderMinor,
      lastPeriodRevenueMinor: previous,
      revenueChangePercent: revenueChange,
      lastDayOrders: todaySeries ?? 0
    },
    series
  }
}

export async function getTopProducts({ from, to, limit = 10 }) {
  const now = new Date()
  const start = from ? new Date(from) : new Date(now.getTime() - 30 * 86400000)
  const end = to ? new Date(to) : now
  const rows = await Order.aggregate([
    { $match: { status: { $nin: [...REVENUE_EXCLUDED] }, createdAt: { $gte: start, $lte: end } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        units: { $sum: '$items.quantity' },
        revenueMinor: { $sum: '$items.lineTotalMinor' }
      }
    },
    { $sort: { revenueMinor: -1 } },
    { $limit: limit }
  ])
  const products = await Product.find({ _id: { $in: rows.map((row) => row._id) } })
    .select('name sku images slug status priceMinor')
    .lean()
  const productMap = new Map(products.map((product) => [product._id.toString(), product]))
  const unitsTotal = rows.reduce((sum, row) => sum + row.units, 0)
  return {
    items: rows.map((row) => {
      const product = productMap.get(row._id.toString())
      return {
        productId: row._id.toString(),
        name: product?.name ?? 'Deleted product',
        sku: product?.sku ?? null,
        slug: product?.slug ?? null,
        imageUrl: product?.images?.[0]?.url ?? null,
        priceMinor: product?.priceMinor ?? null,
        units: row.units,
        revenueMinor: row.revenueMinor,
        sharePercent: unitsTotal ? Math.round((row.units / unitsTotal) * 1000) / 10 : 0
      }
    }),
    meta: { unitsTotal, revenueMinor: rows.reduce((sum, row) => sum + row.revenueMinor, 0) }
  }
}

export async function getRecentCustomers(limit = 6) {
  const users = await User.find({ role: UserRoles.CUSTOMER })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
  return users.map((user) => toPublicUser(user))
}
