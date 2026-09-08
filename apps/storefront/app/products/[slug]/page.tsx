import type { Metadata } from 'next'

import { ProductDetailView } from '@/components/product-detail'

type ProductSeo = {
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  images: { url: string; alt: string }[]
}

type ProductLd = {
  name: string
  slug: string
  sku: string
  brand: { name: string } | null
  shortDescription: string | null
  description: string | null
  images: { url: string }[]
  priceMinor: number
  currency: string
  stockStatus: string
  ratingAverage: number | null
  ratingCount: number
  breadcrumb?: Array<{ name: string; slug: string }>
}

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function availabilityValue(status: string | null): string {
  switch (status) {
    case 'in_stock':
      return 'https://schema.org/InStock'
    case 'low_stock':
      return 'https://schema.org/LimitedAvailability'
    case 'out_of_stock':
      return 'https://schema.org/OutOfStock'
    default:
      return 'https://schema.org/OutOfStock'
  }
}

function productJsonLd(product: ProductLd) {
  const description = product.shortDescription ?? product.description
  const firstImage = product.images[0]?.url
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: firstImage ? [firstImage] : undefined,
    description: description ?? undefined,
    sku: product.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: product.currency || 'USD',
      price: (Number(product.priceMinor ?? 0) / 100).toFixed(2),
      availability: availabilityValue(product.stockStatus),
      itemCondition: 'https://schema.org/NewCondition'
    },
    aggregateRating:
      product.ratingCount > 0 && product.ratingAverage != null
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount
          }
        : undefined
  }
}

function breadcrumbJsonLd(product: ProductLd) {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/products` },
    ...(product.breadcrumb ?? []).slice(0, 2).map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 3,
      name: entry.name,
      item: `${SITE_URL}/products?category=${encodeURIComponent(entry.slug)}`
    }))
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
  }
}

async function fetchProductLd(slug: string): Promise<ProductLd | null> {
  try {
    const response = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}`, {
      cache: 'no-store'
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { success: boolean; data?: ProductLd }
    if (!payload.success || !payload.data) return null
    return payload.data
  } catch {
    return null
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const fallback: Metadata = { title: 'Product' }

  try {
    const response = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}`, {
      cache: 'no-store'
    })
    if (!response.ok) return fallback
    const payload = (await response.json()) as { success: boolean; data?: ProductSeo }
    if (!payload.success || !payload.data) return fallback

    const product = payload.data
    const description =
      product.shortDescription ?? (product.description ? product.description.slice(0, 200) : null)
    const image = product.images?.[0]

    return {
      title: product.name,
      description: description ?? `Shop ${product.name} at Voltify.`,
      openGraph: {
        title: product.name,
        description: description ?? undefined,
        url: `${SITE_URL}/products/${product.slug}`,
        type: 'website',
        images: image ? [{ url: image.url, alt: image.alt ?? product.name }] : undefined
      }
    }
  } catch {
    return fallback
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await fetchProductLd(slug)
  const jsonLd = product ? productJsonLd(product) : null

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      {product ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(product)) }}
        />
      ) : null}
      <ProductDetailView slug={slug} />
    </>
  )
}
