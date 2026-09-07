import Order, { nextOrderNumber } from './order.model.js'
import Address from '../address/address.model.js'
import Product from '../catalog/product.model.js'
import User from '../auth/user.model.js'
import { getCartByUser, clearCartContents } from '../cart/cart.service.js'
import { validateCoupon, useCoupon as consumeCoupon } from '../coupon/coupon.service.js'
import {
  reserveProductStock,
  reserveVariantStock,
  releaseReservation
} from '../inventory/stock.service.js'
import {
  computeShippingPriceMinor,
  computeTotals,
  listShippingMethods,
  getShippingMethodById
} from './shipping.js'
import { getTaxRatePercent, getPlatformSettings } from '../../config/platformConfig.js'
import { env } from '../../config/env.js'
import { createLogger } from '../../config/logger.js'
import { sendOrderConfirmation, sendOrderStatusUpdate } from '../../services/mailer.service.js'
import { NotFoundError, BadRequestError, PaymentRequiredError } from '../../utils/errors.js'
import { OrderStatuses, OrderPaymentStatuses } from '@shop/types'

const mailLogger = createLogger('order-mail')

function notify(promise) {
  promise.catch((error) => {
    mailLogger.warn({ err: error.message }, 'order notification email failed')
  })
}

function toOrderDto(order) {
  const doc = order.toObject ? order.toObject() : order
  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    paymentMethod: doc.paymentMethod,
    currency: doc.currency,
    itemsCount: doc.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalMinor: doc.subtotalMinor,
    discountMinor: doc.discountMinor,
    shippingMinor: doc.shippingMinor,
    taxMinor: doc.taxMinor,
    totalMinor: doc.totalMinor,
    items: (doc.items ?? []).map((item) => ({
      productId: item.productId?.toString?.() ?? item.productId,
      variantId: item.variantId?.toString?.() ?? item.variantId ?? null,
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      imageUrl: item.imageUrl,
      optionSummary: item.optionSummary,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      lineTotalMinor: item.lineTotalMinor
    })),
    couponCode: doc.couponCode,
    shippingAddress: doc.shippingAddress,
    billingAddress: doc.billingAddress ?? null,
    shippingMethod: doc.shippingMethod,
    email: doc.email,
    timeline: (doc.timeline ?? []).map((event) => ({
      status: event.status,
      note: event.note,
      at: event.at
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

function toOrderSummaryDto(order) {
  const doc = order.toObject ? order.toObject() : order
  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    paymentMethod: doc.paymentMethod,
    currency: doc.currency,
    itemsCount: doc.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalMinor: doc.subtotalMinor,
    discountMinor: doc.discountMinor,
    shippingMinor: doc.shippingMinor,
    taxMinor: doc.taxMinor,
    totalMinor: doc.totalMinor,
    createdAt: doc.createdAt
  }
}

export async function listMyOrders(userId, { page = 1, pageSize = 10, status } = {}) {
  const filter = { user: userId }
  if (status) filter.status = status
  const [orders, totalItems] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Order.countDocuments(filter)
  ])
  return {
    items: orders.map(toOrderSummaryDto),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize)
    }
  }
}

export async function getOrderForUser(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, user: userId })
  if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND')
  return toOrderDto(order)
}

export async function getCheckoutOptions(userId) {
  const [addresses, cart] = await Promise.all([
    Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 }).lean(),
    getCartByUser(userId)
  ])

  await getPlatformSettings()
  const subtotalForShipping = Math.max(0, cart.totals.subtotalMinor - cart.totals.discountMinor)
  const shippingMethods = listShippingMethods().map((method) => ({
    ...method,
    priceMinor: computeShippingPriceMinor(method.id, subtotalForShipping)
  }))

  return {
    cart,
    addresses: addresses.map((address) => ({
      id: address._id.toString(),
      label: address.label,
      fullName: address.fullName,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      isDefault: address.isDefault,
      createdAt: address.createdAt
    })),
    shippingMethods,
    paymentMethods: env.paymentProviders.includes('cod')
      ? [
          {
            id: 'cod',
            name: 'Cash on Delivery',
            description: 'Pay with cash or card when your order arrives.'
          }
        ]
      : [],
    taxRatePercent: getTaxRatePercent()
  }
}

export async function previewOrder(userId, { shippingMethodId }) {
  const { cart } = await getCheckoutOptions(userId)
  if (cart.lines.length === 0) throw new BadRequestError('Your cart is empty', 'CART_EMPTY')
  const method = getShippingMethodById(shippingMethodId)
  if (!method) throw new BadRequestError('Shipping method not found', 'SHIPPING_METHOD_NOT_FOUND')
  const subtotalForShipping = Math.max(0, cart.totals.subtotalMinor - cart.totals.discountMinor)
  const shippingMinor = computeShippingPriceMinor(method.id, subtotalForShipping)
  const totals = computeTotals({
    subtotalMinor: cart.totals.subtotalMinor,
    discountMinor: cart.totals.discountMinor,
    shippingMinor
  })
  return {
    itemsCount: cart.totals.itemsCount,
    lines: cart.lines,
    totals,
    shippingMethod: {
      id: method.id,
      name: method.name,
      description: method.description,
      estimatedDays: method.estimatedDays
    },
    couponCode: cart.couponCode,
    couponDescription: cart.couponDescription
  }
}

export async function placeOrder(userId, { addressId, shippingMethodId, paymentMethod, notes }) {
  const method = getShippingMethodById(shippingMethodId)
  if (!method) throw new BadRequestError('Shipping method not found', 'SHIPPING_METHOD_NOT_FOUND')
  if (!env.paymentProviders.includes(paymentMethod)) {
    throw new PaymentRequiredError(
      'This payment method is not available yet',
      'PAYMENT_NOT_CONFIGURED'
    )
  }

  const [address, cartDto] = await Promise.all([
    Address.findOne({ _id: addressId, user: userId }).lean(),
    getCartByUser(userId)
  ])
  if (!address) throw new BadRequestError('Shipping address not found', 'ADDRESS_NOT_FOUND')
  if (cartDto.lines.length === 0) throw new BadRequestError('Your cart is empty', 'CART_EMPTY')

  const orderNumber = await nextOrderNumber()
  const reserved = []
  const items = []

  try {
    for (const line of cartDto.lines) {
      const product = await Product.findOne({ _id: line.productId }).lean()
      if (!product) throw new BadRequestError('A product in your cart is no longer available')

      const isVariant = line.variantId != null
      if (isVariant) {
        const variant = (product.variants ?? []).find(
          (entry) => entry._id.toString() === line.variantId.toString()
        )
        if (!variant || !variant.active) {
          throw new BadRequestError(
            `${product.name} option is no longer available`,
            'INSUFFICIENT_STOCK'
          )
        }
        await reserveVariantStock(
          product._id,
          variant._id,
          line.quantity,
          { type: 'order', id: orderNumber },
          userId
        )
        items.push({
          productId: product._id,
          variantId: variant._id,
          name: product.name,
          slug: product.slug,
          sku: variant.sku,
          imageUrl: product.images?.[0]?.url ?? null,
          optionSummary: line.optionSummary,
          unitPriceMinor: variant.priceMinor ?? product.priceMinor,
          quantity: line.quantity,
          lineTotalMinor: line.unitPriceMinor * line.quantity
        })
      } else {
        await reserveProductStock(
          product._id,
          line.quantity,
          { type: 'order', id: orderNumber },
          userId
        )
        items.push({
          productId: product._id,
          variantId: null,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          imageUrl: product.images?.[0]?.url ?? null,
          optionSummary: null,
          unitPriceMinor: product.priceMinor,
          quantity: line.quantity,
          lineTotalMinor: line.unitPriceMinor * line.quantity
        })
      }
      reserved.push({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity
      })
    }

    const subtotalMinor = cartDto.totals.subtotalMinor
    const shippingMinor = computeShippingPriceMinor(method.id, subtotalMinor)

    let discountMinor = 0
    let couponCode = null
    let couponDescription = null
    if (cartDto.couponCode) {
      const couponResult = await validateCoupon(cartDto.couponCode, {
        subtotalMinor,
        userId
      })
      discountMinor = couponResult.discountMinor
      couponCode = cartDto.couponCode
      couponDescription = couponResult.description
    }

    const totals = computeTotals({ subtotalMinor, discountMinor, shippingMinor })

    const addressSnapshot = {
      fullName: address.fullName,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      state: address.state ?? null,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone ?? null
    }

    const order = await Order.create({
      orderNumber,
      user: userId,
      status: OrderStatuses.PENDING,
      paymentStatus:
        paymentMethod === 'cod' ? OrderPaymentStatuses.PENDING : OrderPaymentStatuses.PAID,
      paymentMethod,
      currency: 'USD',
      items,
      couponCode,
      couponDescription,
      subtotalMinor,
      discountMinor,
      shippingMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      shippingMethod: {
        id: method.id,
        name: method.name,
        estimatedDays: method.estimatedDays
      },
      shippingAddress: addressSnapshot,
      billingAddress: addressSnapshot,
      email: null,
      notes: notes ?? null,
      timeline: [{ status: OrderStatuses.PENDING, note: 'Order placed', at: new Date() }]
    })

    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, { subtotalMinor, userId })
      await consumeCoupon(couponResult.coupon, userId)
    }
    await clearCartContents({ user: userId })

    const customer = await User.findById(userId).select('email name').lean()
    const recipient = {
      to: customer?.email,
      name: customer?.name || address.fullName || 'there'
    }
    if (recipient.to) {
      notify(
        sendOrderConfirmation({
          ...recipient,
          orderNumber,
          totalMinor: order.totalMinor,
          currency: order.currency
        })
      )
    }

    return { order: toOrderDto(order) }
  } catch (error) {
    for (const item of reserved) {
      await releaseReservation(item.productId, item.variantId, item.quantity, {
        type: 'order',
        id: orderNumber
      })
    }
    throw error
  }
}

const CANCELLABLE_FROM = new Set([OrderStatuses.PENDING, OrderStatuses.CONFIRMED])

export async function cancelMyOrder(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, user: userId })
  if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND')
  if (order.status === OrderStatuses.CANCELLED) {
    throw new BadRequestError('Order is already cancelled', 'ORDER_ALREADY_CANCELLED')
  }
  if (!CANCELLABLE_FROM.has(order.status)) {
    throw new BadRequestError(
      'This order can no longer be cancelled. Contact support for help.',
      'ORDER_NOT_CANCELLABLE'
    )
  }
  order.status = OrderStatuses.CANCELLED
  order.cancelledAt = new Date()
  order.timeline.push({
    status: OrderStatuses.CANCELLED,
    note: 'Cancelled by customer',
    at: new Date()
  })
  await order.save()

  for (const item of order.items) {
    await releaseReservation(
      item.productId,
      item.variantId,
      item.quantity,
      { type: 'order', id: order.orderNumber },
      userId
    )
  }

  const customer = await User.findById(userId).select('email name').lean()
  if (customer?.email) {
    notify(
      sendOrderStatusUpdate({
        to: customer.email,
        name: customer.name || 'there',
        orderNumber: order.orderNumber,
        status: OrderStatuses.CANCELLED,
        note: 'Cancelled by customer'
      })
    )
  }

  return toOrderDto(order)
}
