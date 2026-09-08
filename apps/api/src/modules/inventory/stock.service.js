import { Types } from 'mongoose'

import Product from '../catalog/product.model.js'
import Inventory from './inventory.model.js'
import StockMovement from './stock.movement.model.js'
import { StockMovementReasons } from '@shop/types'
import { BadRequestError } from '../../utils/errors.js'

// Escapes a plain string for use inside a RegExp.
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function recordMovement({ productId, variantId, change, reason, reference, actorUserId }) {
  await StockMovement.create({
    productId,
    variantId: variantId ?? null,
    change,
    reason,
    referenceType: reference?.type ?? 'manual',
    referenceId: reference?.id ?? null,
    note: reference?.note ?? null,
    actorUserId: actorUserId ?? null
  })
}

function raiseInsufficientStock(productName, sku) {
  const err = new BadRequestError(`Insufficient stock for ${productName}`)
  err.code = 'INSUFFICIENT_STOCK'
  err.details = { sku }
  throw err
}

// Returns the authoritative inventory row for a product (base pool when variant
// is null, otherwise the variant row), creating it from the product's stock
// fields on first use (e.g. legacy documents that predate the Inventory model).
async function ensureInventoryRow(productId, variant) {
  const variantId = variant ? variant._id : null
  const existing = await Inventory.findOne({ productId, variantId })
  if (existing) return existing

  const product = await Product.findById(productId).lean()
  if (!product) throw new BadRequestError('Product not found', 'PRODUCT_NOT_FOUND')

  let sku
  let stock
  if (variantId) {
    const found = (product.variants ?? []).find(
      (item) => item._id.toString() === variantId.toString()
    )
    if (!found) throw new BadRequestError('Product not found', 'PRODUCT_NOT_FOUND')
    sku = found.sku
    stock = Math.max(0, Math.round(found.stock ?? 0))
  } else {
    sku = product.sku
    stock = Math.max(0, Math.round(product.stock ?? 0))
  }

  return Inventory.create({ productId, variantId, sku, stock, reserved: 0 })
}

async function reserveRow(productId, variant, quantity) {
  const row = await ensureInventoryRow(productId, variant)
  const updated = await Inventory.findOneAndUpdate(
    {
      _id: row._id,
      $expr: {
        $gte: [{ $subtract: ['$stock', '$reserved'] }, quantity]
      }
    },
    { $inc: { reserved: quantity } },
    { returnDocument: 'after' }
  )
  if (!updated) {
    const product = await Product.findById(productId).lean()
    if (!product) throw new BadRequestError('Product not found', 'PRODUCT_NOT_FOUND')
    raiseInsufficientStock(product.name, row.sku)
  }
  return updated
}

async function syncProductReserved(productId, variant, delta) {
  if (variant) {
    await Product.updateOne(
      { _id: productId, 'variants._id': variant._id },
      { $inc: { 'variants.$[entry].reserved': delta } },
      { arrayFilters: [{ 'entry._id': variant._id }] }
    )
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { reserved: delta } })
  }
}

// Atomically reserves `quantity` from the product-level pool.
export async function reserveProductStock(productId, quantity, reference, actorUserId) {
  const updated = await reserveRow(productId, null, quantity)
  await syncProductReserved(productId, null, quantity)
  await recordMovement({
    productId,
    variantId: null,
    change: -quantity,
    reason: StockMovementReasons.ORDER_PLACED,
    reference,
    actorUserId
  })
  return { availableStock: updated.stock - updated.reserved }
}

// Atomically reserves `quantity` from a specific active variant.
export async function reserveVariantStock(productId, variantId, quantity, reference, actorUserId) {
  const variantDoc = { _id: new Types.ObjectId(variantId) }
  const updated = await reserveRow(productId, variantDoc, quantity)
  await syncProductReserved(productId, variantDoc, quantity)
  await recordMovement({
    productId,
    variantId,
    change: -quantity,
    reason: StockMovementReasons.ORDER_PLACED,
    reference,
    actorUserId
  })
  return { availableStock: updated.stock - updated.reserved }
}

// Releases a previously reserved quantity (order cancel/refund path). The
// decrement is guarded by `reserved >= quantity` so concurrent releases can
// never drive `reserved` negative.
export async function releaseReservation(productId, variantId, quantity, reference, actorUserId) {
  const variant = variantId ? { _id: new Types.ObjectId(variantId) } : null
  const amount = Math.max(0, Math.round(quantity))
  if (amount === 0) return

  const row = await ensureInventoryRow(productId, variant)
  const updated = await Inventory.findOneAndUpdate(
    { _id: row._id, reserved: { $gte: amount } },
    { $inc: { reserved: -amount } },
    { returnDocument: 'after' }
  )
  if (!updated) return

  await syncProductReserved(productId, variant, -amount)
  await recordMovement({
    productId,
    variantId: variantId ?? null,
    change: amount,
    reason: StockMovementReasons.ORDER_CANCELLED,
    reference,
    actorUserId
  })
}

// Atomically finalizes a previously reserved quantity once the goods leave the
// warehouse (order delivered): stock drops by the committed amount and the
// reservation is cleared, keeping availableStock unchanged.
export async function commitReservation(productId, variantId, quantity, reference, actorUserId) {
  const variant = variantId ? { _id: new Types.ObjectId(variantId) } : null
  const row = await ensureInventoryRow(productId, variant)
  const amount = Math.max(0, Math.min(quantity, row.reserved, row.stock))
  if (amount === 0) return

  await Inventory.updateOne({ _id: row._id }, { $inc: { stock: -amount, reserved: -amount } })
  if (variant) {
    await Product.updateOne(
      { _id: productId, 'variants._id': variant._id },
      { $inc: { 'variants.$[entry].stock': -amount, 'variants.$[entry].reserved': -amount } },
      { arrayFilters: [{ 'entry._id': variant._id }] }
    )
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { stock: -amount, reserved: -amount } })
  }
  await recordMovement({
    productId,
    variantId: variantId ?? null,
    change: -amount,
    reason: StockMovementReasons.ORDER_DELIVERED,
    reference,
    actorUserId
  })
}

// Restores committed stock when goods are physically returned.
export async function restoreCommittedStock(
  productId,
  variantId,
  quantity,
  reference,
  actorUserId
) {
  const variant = variantId ? { _id: new Types.ObjectId(variantId) } : null
  const row = await ensureInventoryRow(productId, variant)
  const amount = Math.max(0, Math.round(quantity))
  if (amount === 0) return

  await Inventory.updateOne({ _id: row._id }, { $inc: { stock: amount } })
  if (variant) {
    await Product.updateOne(
      { _id: productId, 'variants._id': variant._id },
      { $inc: { 'variants.$[entry].stock': amount } },
      { arrayFilters: [{ 'entry._id': variant._id }] }
    )
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { stock: amount } })
  }
  await recordMovement({
    productId,
    variantId: variantId ?? null,
    change: amount,
    reason: StockMovementReasons.RETURN,
    reference,
    actorUserId
  })
}

// Admin/manual stock adjustment at product or variant level. Only reasons that
// describe an explicit operator action are permitted; order-lifecycle reasons
// (placed/delivered/cancelled/return) are produced exclusively by the system so
// the ledger stays truthful about what actually moved stock.
const MANUAL_ADJUST_REASONS = new Set([
  StockMovementReasons.MANUAL_ADJUSTMENT,
  StockMovementReasons.RESTOCK
])

export async function adjustStock(
  productId,
  { variantId, delta, reason = StockMovementReasons.MANUAL_ADJUSTMENT, note, actorUserId }
) {
  if (!MANUAL_ADJUST_REASONS.has(reason)) {
    throw new BadRequestError('Unsupported adjustment reason', 'INVALID_ADJUSTMENT_REASON')
  }
  const variant = variantId ? { _id: new Types.ObjectId(variantId) } : null
  const row = await ensureInventoryRow(productId, variant)
  await Inventory.updateOne(
    { _id: row._id },
    { $inc: { stock: Math.round(delta) } },
    { runValidators: false }
  )
  if (variant) {
    await Product.updateOne(
      { _id: productId, 'variants._id': variant._id },
      { $inc: { 'variants.$[entry].stock': Math.round(delta) } },
      { arrayFilters: [{ 'entry._id': variant._id }] }
    )
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { stock: Math.round(delta) } })
  }
  await recordMovement({
    productId,
    variantId: variantId ?? null,
    change: Math.round(delta),
    reason,
    reference: { type: 'manual', note: note ?? null },
    actorUserId
  })
}
