'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Archive, Boxes } from 'lucide-react'

import { getJson, patchJson, postJson } from '@/lib/api'
import type { Product } from '@/lib/admin-types'
import { ProductForm } from '@/components/admin/product-form'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import { ErrorAlert, LoadingCard, PageHeader, StatusBadge } from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'

export default function EditProductPage() {
  const params = useParams<{ id: string }>()
  const productId = params.id
  const [actionError, setActionError] = React.useState<string | null>(null)

  const {
    data: product,
    loading,
    error
  } = useAsync<Product>(() => getJson(`/admin/products/${productId}`), [productId])

  const setStatus = async (status: string) => {
    setActionError(null)
    try {
      await patchJson(`/admin/products/${productId}`, { status })
      window.location.reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const archive = async () => {
    const confirmed = window.confirm('Archive this product? It will be hidden from the store.')
    if (!confirmed) return
    setActionError(null)
    try {
      await postJson(`/admin/products/${productId}/archive`, {})
      window.location.reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  if (loading) return <LoadingCard />
  if (error || !product) return <ErrorAlert message={error ?? 'Product not found'} />

  const isPublished = product.status === 'published'

  return (
    <>
      <div className="mb-4">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to products
        </Link>
      </div>

      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category?.name ?? 'No category'} · ${formatMoney(product.priceMinor)}`}
      >
        <StatusBadge kind="product" value={product.status} />
        {product.featured ? <Badge variant="outline">Featured</Badge> : null}
        <Button asChild variant="outline">
          <Link href={`/products/${productId}/inventory`}>
            <Boxes /> Inventory
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => void setStatus(isPublished ? 'draft' : 'published')}
        >
          {isPublished ? 'Move to draft' : 'Publish'}
        </Button>
        <Button
          variant="destructive"
          onClick={() => void archive()}
          disabled={product.status === 'archived'}
        >
          <Archive /> Archive
        </Button>
      </PageHeader>

      {actionError ? <ErrorAlert message={actionError} className="mb-4" /> : null}

      <ProductForm productId={productId} />
    </>
  )
}
