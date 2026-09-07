import { getTaxRatePercent } from '../../config/platformConfig.js'
import { BadRequestError } from '../../utils/errors.js'

export const SHIPPING_METHODS = [
  {
    id: 'standard',
    name: 'Standard Shipping',
    description: 'Delivered in 5–7 business days',
    basePriceMinor: 499,
    freeThresholdMinor: 3500,
    estimatedDays: '5–7 business days'
  },
  {
    id: 'express',
    name: 'Express Shipping',
    description: 'Delivered in 2–3 business days',
    basePriceMinor: 1299,
    freeThresholdMinor: null,
    estimatedDays: '2–3 business days'
  },
  {
    id: 'priority',
    name: 'Priority Shipping',
    description: 'Delivered in 1–2 business days',
    basePriceMinor: 2499,
    freeThresholdMinor: null,
    estimatedDays: '1–2 business days'
  }
]

export function getShippingMethodById(id) {
  return SHIPPING_METHODS.find((method) => method.id === id) ?? null
}

export function listShippingMethods() {
  return SHIPPING_METHODS.map(({ basePriceMinor: _b, freeThresholdMinor: _f, ...rest }) => ({
    ...rest
  }))
}

export function computeShippingPriceMinor(shippingMethodId, subtotalMinor) {
  const method = getShippingMethodById(shippingMethodId)
  if (!method) throw new BadRequestError('Shipping method not found', 'SHIPPING_METHOD_NOT_FOUND')
  if (method.freeThresholdMinor && subtotalMinor >= method.freeThresholdMinor) return 0
  return method.basePriceMinor
}

export function computeTotals({ subtotalMinor, discountMinor, shippingMinor }) {
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor)
  const taxMinor = Math.round((taxableMinor * getTaxRatePercent()) / 100)
  const totalMinor = Math.max(0, subtotalMinor - discountMinor) + shippingMinor + taxMinor
  return {
    subtotalMinor,
    discountMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    currency: 'USD'
  }
}
