import { Suspense } from 'react'

import { ProductsClient } from '@/components/products-client'

export default function ProductsPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">Loading…</div>}
    >
      <ProductsClient />
    </Suspense>
  )
}
