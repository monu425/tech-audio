import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { connectDB, disconnectDB } from '../src/config/db.js'
import { startTestDb, stopTestDb } from './helpers/mongo.js'
import {
  createBrand,
  createCategory,
  createProduct,
  slugify
} from '../src/modules/catalog/catalog.service.js'

describe('public catalog', () => {
  let request
  let app

  let categoryId
  let categorySlug
  let brandId
  let product
  let expensive
  let draft
  let featured

  async function seed() {
    const brand = await createBrand({ name: 'Acme Gear', status: 'active' })
    brandId = brand.id

    const parent = await createCategory({ name: 'Home & Kitchen', status: 'active' })
    const child = await createCategory({
      name: 'Cookware',
      status: 'active',
      parentId: parent.id
    })
    categoryId = child.id
    categorySlug = child.slug

    product = await createProduct({
      name: 'Nebula Skillet',
      sku: 'SKILLET-01',
      priceMinor: 2500,
      compareAtMinor: 3200,
      stock: 6,
      brandId,
      categoryId,
      status: 'published',
      images: [{ url: 'https://img.example.com/skillet.jpg', alt: 'Nebula Skillet' }],
      tags: ['cookware', 'kitchen']
    })

    expensive = await createProduct({
      name: 'Aurora Knife Set',
      sku: 'KNIFE-01',
      priceMinor: 7000,
      stock: 3,
      brandId,
      categoryId,
      status: 'published',
      featured: true
    })

    featured = expensive

    draft = await createProduct({
      name: 'Unreleased Gadget',
      sku: 'DRAFT-01',
      priceMinor: 999,
      stock: 1,
      categoryId,
      status: 'draft'
    })
  }

  beforeAll(async () => {
    const uri = await startTestDb()
    await connectDB(uri)
    await seed()
    app = createApp()
    const supertest = (await import('supertest')).default
    request = supertest(app)
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
  })

  it('lists only published products with metadata', async () => {
    const res = await request.get('/api/v1/catalog/products')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const slugs = res.body.data.items.map((item) => item.slug)
    expect(slugs).toContain(product.slug)
    expect(slugs).toContain(expensive.slug)
    expect(slugs).not.toContain(draft.slug)
    expect(res.body.data.meta.totalItems).toBe(2)
  })

  it('filters by category slug', async () => {
    const res = await request
      .get('/api/v1/catalog/products')
      .query({ category: categorySlug, pageSize: 50 })
    expect(res.status).toBe(200)
    const slugs = res.body.data.items.map((item) => item.slug)
    expect(slugs).toContain(product.slug)
    expect(slugs).toContain(expensive.slug)
  })

  it('filters by brand slug and returns only matching items', async () => {
    const res = await request.get('/api/v1/catalog/products').query({ brand: 'acme-gear' })
    expect(res.status).toBe(200)
    expect(res.body.data.meta.totalItems).toBe(2)
  })

  it('filters by price range', async () => {
    const res = await request
      .get('/api/v1/catalog/products')
      .query({ minPrice: 3000, maxPrice: 10000 })
    expect(res.status).toBe(200)
    const slugs = res.body.data.items.map((item) => item.slug)
    expect(slugs).toContain(expensive.slug)
    expect(slugs).not.toContain(product.slug)
  })

  it('searches products by name', async () => {
    const res = await request.get('/api/v1/catalog/products').query({ q: 'Nebula' })
    expect(res.status).toBe(200)
    const slugs = res.body.data.items.map((item) => item.slug)
    expect(slugs).toContain(product.slug)
  })

  it('paginates results', async () => {
    const res = await request.get('/api/v1/catalog/products').query({ page: 1, pageSize: 1 })
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.meta.totalPages).toBe(2)
  })

  it('exposes product summaries with money and stock info', async () => {
    const res = await request.get('/api/v1/catalog/products').query({ q: 'Nebula', pageSize: 10 })
    const item = res.body.data.items[0]
    expect(item.priceMinor).toBe(2500)
    expect(item.compareAtMinor).toBe(3200)
    expect(item.discountPercent).toBe(22)
    expect(item.availableStock).toBeGreaterThan(0)
    expect(item.currency).toBe('USD')
    expect(item.brand).toMatchObject({ name: 'Acme Gear' })
    expect(item.image.url).toContain('skillet.jpg')
  })

  it('returns a full product by slug', async () => {
    const res = await request.get(`/api/v1/catalog/products/${product.slug}`)
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data.id).toBe(product.id)
    expect(data.name).toBe('Nebula Skillet')
    expect(data.sku).toBe('SKILLET-01')
    expect(data.breadcrumb.some((item) => item.name === 'Cookware')).toBe(true)
  })

  it('returns 404 for an unknown or draft product slug', async () => {
    const missing = await request.get('/api/v1/catalog/products/does-not-exist')
    expect(missing.status).toBe(404)
    const hidden = await request.get(`/api/v1/catalog/products/${draft.slug}`)
    expect(hidden.status).toBe(404)
  })

  it('returns featured published products', async () => {
    const res = await request.get('/api/v1/catalog/featured')
    expect(res.status).toBe(200)
    const slugs = res.body.data.map((item) => item.slug)
    expect(slugs).toContain(featured.slug)
  })

  it('returns related products that exclude the current product', async () => {
    const res = await request.get(`/api/v1/catalog/products/${product.slug}/related`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.items)).toBe(true)
    const slugs = res.body.data.items.map((item) => item.slug)
    expect(slugs).not.toContain(product.slug)
    expect(slugs.length).toBeLessThanOrEqual(8)
  })

  it('returns search suggestions matching the query', async () => {
    const res = await request.get('/api/v1/catalog/suggestions').query({ q: 'Neb' })
    expect(res.status).toBe(200)
    const names = res.body.data.suggestions.map((entry) => entry.name)
    expect(names).toContain('Nebula Skillet')
  })

  it('lists active brands', async () => {
    const res = await request.get('/api/v1/catalog/brands')
    expect(res.status).toBe(200)
    const slugs = res.body.data.items.map((item) => item.slug)
    expect(slugs).toContain('acme-gear')
  })

  it('lists active categories and builds a nested tree', async () => {
    const flat = await request.get('/api/v1/catalog/categories')
    expect(flat.status).toBe(200)
    const leaf = flat.body.data.items.find((item) => item.slug === 'cookware')
    expect(leaf).toBeTruthy()

    const tree = await request.get('/api/v1/catalog/category-tree')
    expect(tree.status).toBe(200)
    const home = tree.body.data.find((node) => node.slug === slugify('Home & Kitchen'))
    expect(home).toBeTruthy()
    expect(home.children.some((child) => child.slug === 'cookware')).toBe(true)
  })

  it('resolves a category by slug with breadcrumb', async () => {
    const res = await request.get(`/api/v1/catalog/categories/${categorySlug}`)
    expect(res.status).toBe(200)
    expect(res.body.data.category.name).toBe('Cookware')
    expect(res.body.data.breadcrumb.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 404 for an unknown category slug', async () => {
    const res = await request.get('/api/v1/catalog/categories/nope')
    expect(res.status).toBe(404)
  })
})
