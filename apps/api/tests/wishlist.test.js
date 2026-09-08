import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import supertest from 'supertest'

// Deterministic OTPs; real crypto preserved.
vi.mock('../src/services/security.service.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    randomOtp: vi.fn(() => '123456')
  }
})

import { connectDB, disconnectDB } from '../src/config/db.js'
import { createApp } from '../src/app.js'
import { startTestDb, stopTestDb } from './helpers/mongo.js'
import {
  createBrand,
  createCategory,
  createProduct
} from '../src/modules/catalog/catalog.service.js'

const STORE_ORIGIN = 'http://localhost:3000'
const TEST_OTP = '123456'

describe('wishlist move-to-cart (variant resolution)', () => {
  let app
  let request
  let buyer
  let plain
  let sock
  let mug
  let gizmo

  const emailCounters = {}
  function makeEmail(prefix) {
    emailCounters[prefix] = (emailCounters[prefix] || 0) + 1
    return `${prefix}-${emailCounters[prefix]}@example.com`
  }

  async function registerUser(email, password = 'Strong123') {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Shopper',
      email,
      password,
      confirmPassword: password
    })
    expect(res.status).toBe(201)
  }

  async function verifiedAgent(email) {
    const jar = supertest.agent(app)
    await registerUser(email)
    const verifyRes = await jar
      .post('/api/v1/auth/verify-email')
      .set('Origin', STORE_ORIGIN)
      .send({ email, code: TEST_OTP })
    expect(verifyRes.status).toBe(200)
    return jar
  }

  beforeAll(async () => {
    const uri = await startTestDb()
    await connectDB(uri)

    await createBrand({ name: 'Voltify', status: 'active' })
    const category = await createCategory({ name: 'Apparel', status: 'active' })

    plain = await createProduct({
      name: 'Canvas Tote',
      sku: 'TOTE-01',
      priceMinor: 1000,
      stock: 5,
      categoryId: category.id,
      status: 'published'
    })
    sock = await createProduct({
      name: 'Crew Sock',
      sku: 'SOCK-00',
      priceMinor: 800,
      stock: 0,
      categoryId: category.id,
      status: 'published',
      variants: [
        { sku: 'SOCK-M', options: { size: 'M' }, priceMinor: 800, stock: 3, active: true },
        { sku: 'SOCK-L', options: { size: 'L' }, priceMinor: 800, stock: 9, active: false }
      ]
    })
    mug = await createProduct({
      name: 'Ceramic Mug',
      sku: 'MUG-00',
      priceMinor: 1200,
      stock: 0,
      categoryId: category.id,
      status: 'published',
      variants: [
        { sku: 'MUG-RED', options: { color: 'red' }, priceMinor: 1200, stock: 2, active: true },
        { sku: 'MUG-BLU', options: { color: 'blue' }, priceMinor: 1200, stock: 4, active: true }
      ]
    })
    gizmo = await createProduct({
      name: 'Gadget',
      sku: 'GIZMO-00',
      priceMinor: 500,
      stock: 0,
      categoryId: category.id,
      status: 'published',
      variants: [
        { sku: 'GIZMO-1', options: { model: 'one' }, priceMinor: 500, stock: 0, active: true }
      ]
    })

    app = createApp()
    request = supertest(app)
    buyer = await verifiedAgent(makeEmail('wishlist-buyer'))
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  function variantId(product, sku) {
    return product.variants.find((variant) => variant.sku === sku)._id.toString()
  }

  async function addToWishlist(productId) {
    const res = await buyer.post('/api/v1/wishlist/items').send({ productId })
    expect(res.status).toBe(201)
  }

  beforeAll(async () => {
    await addToWishlist(plain.id)
    await addToWishlist(sock.id)
    await addToWishlist(mug.id)
    await addToWishlist(gizmo.id)
  })

  it('moves a plain product and removes it from the wishlist', async () => {
    const res = await buyer
      .post('/api/v1/wishlist/items/move-to-cart')
      .send({ productId: plain.id })
    expect(res.status).toBe(200)
    const line = res.body.data.lines.find((item) => item.productId === plain.id)
    expect(line.variantId).toBeNull()
    expect(line.quantity).toBe(1)

    const wishlist = await buyer.get('/api/v1/wishlist')
    const ids = wishlist.body.data.items.map((item) => item.product.id)
    expect(ids).not.toContain(plain.id)
  })

  it('auto-selects the only active variant for a variant product', async () => {
    const expectedVariant = variantId(sock, 'SOCK-M')
    const res = await buyer.post('/api/v1/wishlist/items/move-to-cart').send({ productId: sock.id })
    expect(res.status).toBe(200)
    const line = res.body.data.lines.find((item) => item.productId === sock.id)
    expect(line.variantId).toBe(expectedVariant)
    expect(line.sku).toBe('SOCK-M')
    expect(line.quantity).toBe(1)
  })

  it('requires an explicit option when the product has multiple active variants', async () => {
    const res = await buyer.post('/api/v1/wishlist/items/move-to-cart').send({ productId: mug.id })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VARIANT_REQUIRED')

    const wishlist = await buyer.get('/api/v1/wishlist')
    const ids = wishlist.body.data.items.map((item) => item.product.id)
    expect(ids).toContain(mug.id)
  })

  it('moves a selected variant when one is provided', async () => {
    const selected = variantId(mug, 'MUG-RED')
    const res = await buyer
      .post('/api/v1/wishlist/items/move-to-cart')
      .send({ productId: mug.id, variantId: selected })
    expect(res.status).toBe(200)
    const line = res.body.data.lines.find((item) => item.productId === mug.id)
    expect(line.variantId).toBe(selected)
    expect(line.sku).toBe('MUG-RED')

    const wishlist = await buyer.get('/api/v1/wishlist')
    const ids = wishlist.body.data.items.map((item) => item.product.id)
    expect(ids).not.toContain(mug.id)
  })

  it('rejects a variant that does not belong to the product', async () => {
    await buyer.post('/api/v1/wishlist/items').send({ productId: mug.id })

    const foreign = variantId(sock, 'SOCK-M')
    const res = await buyer
      .post('/api/v1/wishlist/items/move-to-cart')
      .send({ productId: mug.id, variantId: foreign })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VARIANT_NOT_FOUND')
  })

  it('keeps the wishlist item when the move fails on stock', async () => {
    const res = await buyer
      .post('/api/v1/wishlist/items/move-to-cart')
      .send({ productId: gizmo.id })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('OUT_OF_STOCK')

    const wishlist = await buyer.get('/api/v1/wishlist')
    const ids = wishlist.body.data.items.map((item) => item.product.id)
    expect(ids).toContain(gizmo.id)
  })
})
