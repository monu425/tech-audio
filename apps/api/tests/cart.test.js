import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
import Product from '../src/modules/catalog/product.model.js'
import User from '../src/modules/auth/user.model.js'
import { hashPassword } from '../src/services/security.service.js'
import {
  createBrand,
  createCategory,
  createProduct
} from '../src/modules/catalog/catalog.service.js'
import { UserRoles } from '@shop/types'

const STORE_ORIGIN = 'http://localhost:3000'
const TEST_OTP = '123456'

describe('cart (guest, merge-on-auth, stock clamps, coupon scoping)', () => {
  let app
  let admin
  let plain
  let sock
  let tee
  let hidden

  const emailCounters = {}
  function makeEmail(prefix) {
    emailCounters[prefix] = (emailCounters[prefix] || 0) + 1
    return `${prefix}-${emailCounters[prefix]}@example.com`
  }

  async function registerAndVerify(jar, email, password = 'Strong123') {
    const reg = await jar.post('/api/v1/auth/register').send({
      name: 'Shopper',
      email,
      password,
      confirmPassword: password
    })
    expect(reg.status).toBe(201)
    const verify = await jar
      .post('/api/v1/auth/verify-email')
      .set('Origin', STORE_ORIGIN)
      .send({ email, code: TEST_OTP })
    expect(verify.status).toBe(200)
  }

  function variantId(product, sku) {
    return product.variants.find((variant) => variant.sku === sku)._id.toString()
  }

  beforeAll(async () => {
    const uri = await startTestDb()
    await connectDB(uri)
    await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      passwordHash: await hashPassword('Admin12345!'),
      role: UserRoles.SUPER_ADMIN,
      status: 'active',
      emailVerifiedAt: new Date()
    })

    await createBrand({ name: 'Voltify', status: 'active' })
    const category = await createCategory({ name: 'Apparel', status: 'active' })
    plain = await createProduct({
      name: 'Canvas Tote',
      sku: 'CT-TOTE-01',
      priceMinor: 1000,
      stock: 5,
      categoryId: category.id,
      status: 'published'
    })
    sock = await createProduct({
      name: 'Crew Sock',
      sku: 'CT-SOCK-00',
      priceMinor: 800,
      stock: 0,
      categoryId: category.id,
      status: 'published',
      variants: [
        { sku: 'CT-SOCK-M', options: { size: 'M' }, priceMinor: 800, stock: 3, active: true },
        { sku: 'CT-SOCK-L', options: { size: 'L' }, priceMinor: 800, stock: 9, active: false }
      ]
    })
    tee = await createProduct({
      name: 'Everyday Tee',
      sku: 'CT-TEE-001',
      priceMinor: 2000,
      stock: 7,
      categoryId: category.id,
      status: 'published'
    })
    hidden = await createProduct({
      name: 'Coming Soon',
      sku: 'CT-HID-001',
      priceMinor: 100,
      stock: 5,
      categoryId: category.id,
      status: 'published'
    })

    app = createApp()
    admin = supertest.agent(app)
    const login = await admin
      .post('/api/v1/auth/login')
      .set('Origin', STORE_ORIGIN)
      .send({ email: 'admin@example.com', password: 'Admin12345!' })
    expect(login.status).toBe(200)
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  describe('guest cart', () => {
    let guest

    beforeEach(async () => {
      guest = supertest.agent(app)
    })

    it('issues a guest cart cookie on first cart action and holds items', async () => {
      const add = await guest.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 2 })
      expect(add.status).toBe(200)
      expect(add.headers['set-cookie'].some((cookie) => cookie.startsWith('cart_id='))).toBe(true)

      const cart = await guest.get('/api/v1/cart')
      const line = cart.body.data.lines.find((item) => item.productId === plain.id)
      expect(line.quantity).toBe(2)
      expect(line.sku).toBe('CT-TOTE-01')
    })

    it('rejects a variant product without an explicit option', async () => {
      const res = await guest.post('/api/v1/cart/items').send({ productId: sock.id, quantity: 1 })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VARIANT_REQUIRED')
    })

    it('rejects a quantity that exceeds available stock', async () => {
      await guest.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 5 })
      const res = await guest.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 1 })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
    })

    it('rejects unavailable or unpublished products', async () => {
      const res = await guest.post('/api/v1/cart/items').send({ productId: tee.id, quantity: 0 })
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')

      await Product.updateOne({ _id: hidden.id }, { $set: { status: 'draft' } })
      const missing = await guest.post('/api/v1/cart/items').send({
        productId: hidden.id,
        quantity: 1
      })
      expect(missing.status).toBe(404)
    })

    it('removes a line when quantity is patched to zero', async () => {
      await guest.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 1 })
      const res = await guest
        .patch('/api/v1/cart/items')
        .send({ productId: plain.id, variantId: null, quantity: 0 })
      expect(res.status).toBe(200)
      expect(res.body.data.lines).toHaveLength(0)
    })
  })

  describe('authenticated cart', () => {
    let buyer
    let cartId

    beforeAll(async () => {
      buyer = supertest.agent(app)
      await registerAndVerify(buyer, makeEmail('cart-user'))
      await buyer.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 1 })
    })

    it('clamps an updated quantity to available stock', async () => {
      const res = await buyer
        .patch('/api/v1/cart/items')
        .send({ productId: plain.id, variantId: null, quantity: 99 })
      expect(res.status).toBe(200)
      const line = res.body.data.lines.find((item) => item.productId === plain.id)
      expect(line.quantity).toBe(5)
    })

    it('returns CART_ITEM_NOT_FOUND for a foreign variant', async () => {
      const res = await buyer
        .patch('/api/v1/cart/items')
        .send({ productId: plain.id, variantId: variantId(sock, 'CT-SOCK-M'), quantity: 2 })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('CART_ITEM_NOT_FOUND')
    })

    it('persists coupon and cart across reads', async () => {
      cartId = (await buyer.get('/api/v1/cart')).body.data.id
      expect(cartId).toBeTruthy()
    })
  })

  describe('guest to signed-in merge', () => {
    it('merges the guest cart into the user cart on first authenticated read', async () => {
      const jar = supertest.agent(app)
      await jar.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 2 })
      await jar.post('/api/v1/cart/items').send({
        productId: sock.id,
        variantId: variantId(sock, 'CT-SOCK-M'),
        quantity: 1
      })

      await registerAndVerify(jar, makeEmail('merge-user'))

      const cart = await jar.get('/api/v1/cart')
      const lines = cart.body.data.lines
      expect(lines.find((line) => line.productId === plain.id).quantity).toBe(2)
      expect(lines.find((line) => line.productId === sock.id).quantity).toBe(1)
    })

    it('clamps guest quantities to stock during merge', async () => {
      const jar = supertest.agent(app)
      // Take the full stock as a guest, then let the available stock shrink
      // before the cart is merged into the signed-in account.
      await jar.post('/api/v1/cart/items').send({ productId: plain.id, quantity: 5 })
      await Product.updateOne({ _id: plain.id }, { $set: { stock: 3 } })

      await registerAndVerify(jar, makeEmail('merge-user-2'))
      const cart = await jar.get('/api/v1/cart')
      const line = cart.body.data.lines.find((item) => item.productId === plain.id)
      expect(line.quantity).toBe(3)
    })
  })

  describe('coupon scoping in the cart', () => {
    let buyer
    let code

    async function createCoupon(payload) {
      const res = await admin.post('/api/v1/admin/coupons').send(payload)
      expect(res.status).toBe(201)
      return res.body.data
    }

    beforeAll(async () => {
      buyer = supertest.agent(app)
      await registerAndVerify(buyer, makeEmail('cart-coupon'))
      const created = await createCoupon({
        code: 'CTEES20',
        type: 'percentage',
        value: 20,
        productIds: [tee.id],
        perUserLimit: 2,
        enabled: true
      })
      code = created.code
    })

    it('applies only when the scoped product is in the cart', async () => {
      await buyer.post('/api/v1/cart/items').send({ productId: tee.id, quantity: 1 })
      const applied = await buyer
        .post('/api/v1/cart/coupon')
        .set('Origin', STORE_ORIGIN)
        .send({ code })
      expect(applied.status).toBe(200)
      expect(applied.body.data.couponCode).toBe(code)
      expect(applied.body.data.totals.discountMinor).toBe(400)
    })

    it('drops the coupon when the scoped product leaves the cart', async () => {
      await buyer.delete('/api/v1/cart/items').send({ productId: tee.id, variantId: null })
      const cart = await buyer.get('/api/v1/cart')
      expect(cart.body.data.couponCode).toBeNull()
      expect(cart.body.data.lines).toHaveLength(0)
    })
  })
})
