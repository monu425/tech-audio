'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { ProductForm } from '@/components/admin/product-form'
import { PageHeader } from '@/components/admin/primitives'

export default function NewProductPage() {
  const router = useRouter()

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
      <PageHeader title="New product" description="Create a product in the catalog." />
      <ProductForm onSaved={(id) => router.push(`/products/${id}`)} />
    </>
  )
}
