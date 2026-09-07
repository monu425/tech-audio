import type { Metadata } from 'next'

import { ProductDetailView } from '@/components/product-detail'

type ProductSeo = {
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  images: { url: string; alt: string }[]
}

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1'

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
        url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/products/${product.slug}`,
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
  return <ProductDetailView slug={slug} />
}
