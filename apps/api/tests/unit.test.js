import { describe, expect, it } from 'vitest'

import { slugify } from '../src/modules/catalog/catalog.service.js'
import { escapeRegex } from '../src/modules/inventory/stock.service.js'
import {
  getShippingMethodById,
  listShippingMethods,
  computeShippingPriceMinor,
  SHIPPING_METHODS
} from '../src/modules/orders/shipping.js'
import { detectImageType, IMAGE_MIME_TYPES } from '../src/modules/media/media.service.js'
import { isAllowedSource } from '../src/config/env.js'

describe('slugify', () => {
  it('lowercases and trims input', () => {
    expect(slugify('  Nebula Skillet ')).toBe('nebula-skillet')
  })

  it('strips quotes and collapses separators', () => {
    expect(slugify(`Home  &  Kitchen's`)).toBe('home-kitchens')
  })

  it('removes leading/trailing separators', () => {
    expect(slugify('- hi there -')).toBe('hi-there')
  })

  it('caps length at 200 characters', () => {
    const long = 'a'.repeat(300)
    expect(slugify(long).length).toBe(200)
  })
})

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b*c(d)')).toBe('a\\.b\\*c\\(d\\)')
  })

  it('leaves plain text untouched', () => {
    expect(escapeRegex('plain text 123')).toBe('plain text 123')
  })
})

describe('shipping helpers', () => {
  it('lists shipping methods without pricing internals', () => {
    const methods = listShippingMethods()
    expect(methods.map((method) => method.id)).toEqual(['standard', 'express', 'priority'])
    for (const method of methods) {
      expect(method).not.toHaveProperty('basePriceMinor')
      expect(method).not.toHaveProperty('freeThresholdMinor')
    }
  })

  it('resolves methods by id', () => {
    expect(getShippingMethodById('express').basePriceMinor).toBe(1299)
    expect(getShippingMethodById('missing')).toBeNull()
  })

  it('charges base price below the free threshold', () => {
    expect(computeShippingPriceMinor('standard', 1000)).toBe(499)
  })

  it('offers free standard shipping at or above the threshold', () => {
    expect(computeShippingPriceMinor('standard', 3500)).toBe(0)
    expect(computeShippingPriceMinor('standard', 5000)).toBe(0)
  })

  it('charges flat rates for express and priority', () => {
    expect(computeShippingPriceMinor('express', 50000)).toBe(1299)
    expect(computeShippingPriceMinor('priority', 1)).toBe(2499)
  })

  it('exposes a stable known set of methods', () => {
    expect(SHIPPING_METHODS).toHaveLength(3)
  })
})

describe('media image sniffing', () => {
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

  it('recognises png and gif signatures', () => {
    expect(detectImageType(PNG)).toMatchObject({ mime: 'image/png', ext: 'png' })
    expect(detectImageType(GIF)).toMatchObject({ mime: 'image/gif', ext: 'gif' })
  })

  it('rejects arbitrary bytes', () => {
    expect(detectImageType(Buffer.from('hello world'))).toBeNull()
    expect(detectImageType(Buffer.alloc(0))).toBeNull()
  })

  it('only accepts the configured mime set', () => {
    expect(IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  })
})

describe('isAllowedSource', () => {
  it('allows requests without a source header', () => {
    expect(isAllowedSource(undefined)).toBe(true)
    expect(isAllowedSource('')).toBe(true)
  })

  it('allows configured local origins exactly', () => {
    expect(isAllowedSource('http://localhost:3000')).toBe(true)
    expect(isAllowedSource('http://localhost:3001')).toBe(true)
  })

  it('matches preview hosts on the wildcard suffix', () => {
    expect(isAllowedSource('https://3001-abc123.monkeycode-ai.live')).toBe(true)
    expect(isAllowedSource('https://deep.sub.example.monkeycode-ai.live')).toBe(true)
    expect(isAllowedSource('http://store.monkeycode-ai.live')).toBe(true)
  })

  it('rejects unknown origins', () => {
    expect(isAllowedSource('https://evil.example.com')).toBe(false)
    expect(isAllowedSource('https://monkeycode-ai.live.evil.com')).toBe(false)
  })
})
