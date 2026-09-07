import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1'

type ProductPage = { slug: string; publishedAt: string | null }
type CategoryPage = { slug: string }
type ProductBatch = { items: ProductPage[]; total: number }

async function fetchProductBatch(page: number, pageSize: number): Promise<ProductBatch | null> {
  try {
    const response = await fetch(`${API_URL}/catalog/products?pageSize=${pageSize}&page=${page}`, {
      cache: 'no-store'
    })
    if (!response.ok) return null
    const payload = (await response.json()) as {
      success: boolean
      data?: { items: ProductPage[]; meta: { totalItems: number } }
    }
    if (!payload.success || !payload.data) return null
    return { items: payload.data.items, total: payload.data.meta.totalItems }
  } catch {
    return null
  }
}

async function fetchAllProducts(): Promise<ProductPage[]> {
  const all: ProductPage[] = []
  const pageSize = 100
  for (let page = 1; page <= 10; page += 1) {
    const batch = await fetchProductBatch(page, pageSize)
    if (!batch) break
    for (const item of batch.items) {
      all.push({ slug: item.slug, publishedAt: item.publishedAt })
    }
    if (all.length >= batch.total) break
  }
  return all
}

async function fetchCategories(): Promise<CategoryPage[]> {
  try {
    const response = await fetch(`${API_URL}/catalog/categories`, { cache: 'no-store' })
    if (!response.ok) return []
    const payload = (await response.json()) as {
      success: boolean
      data?: { items: CategoryPage[] }
    }
    return payload.success && payload.data ? payload.data.items : []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([fetchAllProducts(), fetchCategories()])

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8
    }
  ]

  for (const category of categories) {
    entries.push({
      url: `${SITE_URL}/products?category=${encodeURIComponent(category.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.6
    })
  }

  for (const product of products) {
    entries.push({
      url: `${SITE_URL}/products/${encodeURIComponent(product.slug)}`,
      lastModified: product.publishedAt ? new Date(product.publishedAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7
    })
  }

  return entries
}
