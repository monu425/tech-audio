'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { getJson, patchJson, postJson, isApiError } from '@/lib/api'
import type { Product, ProductFormMeta } from '@/lib/admin-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, Field } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ErrorAlert } from '@/components/admin/primitives'
import { useAsync } from '@/components/admin/use-async'
import { ImageUpload } from '@/components/admin/image-upload'

export type ProductFormValues = {
  name: string
  sku: string
  brandId: string
  categoryId: string
  price: string
  compareAt: string
  stock: string
  lowStockThreshold: string
  status: string
  featured: boolean
  shortDescription: string
  description: string
  tags: string
  images: { url: string; alt: string }[]
  variants: {
    sku: string
    optionsText: string
    price: string
    stock: string
    active: boolean
  }[]
}

const EMPTY_FORM: ProductFormValues = {
  name: '',
  sku: '',
  brandId: '',
  categoryId: '',
  price: '',
  compareAt: '',
  stock: '',
  lowStockThreshold: '5',
  status: 'draft',
  featured: false,
  shortDescription: '',
  description: '',
  tags: '',
  images: [],
  variants: []
}

function toMinor(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  const parsed = Number.parseFloat(text)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function parseOptionsText(text: string): Record<string, string> {
  const options: Record<string, string> = {}
  for (const part of text.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf(':')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (key) options[key] = value
  }
  return options
}

function optionsToText(options: Record<string, string>): string {
  return Object.entries(options ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

function hydrate(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    brandId: product.brand?.id ?? '',
    categoryId: product.category?.id ?? '',
    price: product.priceMinor ? String(product.priceMinor / 100) : '',
    compareAt: product.compareAtMinor ? String(product.compareAtMinor / 100) : '',
    stock: product.stock ? String(product.stock) : '',
    lowStockThreshold: String(product.lowStockThreshold ?? 5),
    status: product.status,
    featured: product.featured,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    tags: (product.tags ?? []).join(', '),
    images: (product.images ?? []).map((image) => ({ url: image.url, alt: image.alt ?? '' })),
    variants: (product.variants ?? []).map((variant) => ({
      sku: variant.sku,
      optionsText: optionsToText(variant.options),
      price: variant.priceMinor != null ? String(variant.priceMinor / 100) : '',
      stock: String(variant.stock ?? 0),
      active: variant.active
    }))
  }
}

function fieldIssues(err: unknown): Record<string, string> | null {
  return isApiError(err) && err.fields ? err.fields : null
}

export function ProductForm({
  productId,
  onSaved
}: {
  productId?: string
  onSaved?: (id: string) => void
}) {
  const [form, setForm] = React.useState<ProductFormValues>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldIssuesState, setFieldIssuesState] = React.useState<Record<string, string> | null>(
    null
  )
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null)

  const issue = (field: string) => fieldIssuesState?.[field] ?? fieldIssuesState?.['_root'] ?? null

  const meta = useAsync<ProductFormMeta>(() => getJson('/admin/products/meta'), [])
  const existing = useAsync<Product | null>(
    () => (productId ? getJson(`/admin/products/${productId}`) : Promise.resolve(null)),
    [productId]
  )

  React.useEffect(() => {
    if (existing.data) {
      // Hydrate the form once the existing product has loaded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(hydrate(existing.data))
      setError(null)
    }
  }, [existing.data])

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSavedMessage(null)
    setFieldIssuesState(null)
  }

  const setVariant = (index: number, patch: Partial<ProductFormValues['variants'][number]>) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant
      )
    }))
  }

  const categories = meta.data?.categories ?? []
  const hasParents = categories.some((category) => category.level > 0)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    setFieldIssuesState(null)

    const priceMinor = toMinor(form.price)
    if (priceMinor === null) {
      setError('Please provide a valid price.')
      setSaving(false)
      return
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      brandId: form.brandId || null,
      categoryId: form.categoryId || null,
      priceMinor,
      compareAtMinor: toMinor(form.compareAt),
      lowStockThreshold: Math.max(0, Math.round(Number(form.lowStockThreshold) || 0)),
      status: form.status,
      featured: form.featured,
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      images: form.images.filter((image) => image.url.trim())
    }

    if (!productId) {
      payload.stock = Math.max(0, Math.round(Number(form.stock) || 0))
    }

    if (form.variants.length > 0) {
      payload.variants = form.variants.map((variant) => {
        const variantPrice = toMinor(variant.price)
        return {
          sku: variant.sku.trim() || form.sku.trim(),
          options: parseOptionsText(variant.optionsText),
          priceMinor: variantPrice,
          stock: Math.max(0, Math.round(Number(variant.stock) || 0)),
          active: variant.active
        }
      })
    }

    try {
      const result = productId
        ? await patchJson<Product>(`/admin/products/${productId}`, payload)
        : await postJson<Product>('/admin/products', payload)
      setSavedMessage(productId ? 'Product saved.' : 'Product created.')
      setForm(hydrate(result))
      onSaved?.(result.id)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to save product')
      setFieldIssuesState(fieldIssues(err))
    } finally {
      setSaving(false)
    }
  }

  if (productId && existing.loading) {
    return <p className="text-sm text-muted-foreground">Loading product…</p>
  }
  if (productId && existing.error) {
    return <ErrorAlert message={existing.error} />
  }

  const isDisabled = saving || meta.loading

  return (
    <form onSubmit={submit} className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}
      {savedMessage ? (
        <div className="rounded-md border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {savedMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
          <CardDescription>Basic information shown across the store.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              required
            />
            {issue('name') ? <p className="text-xs text-destructive">{issue('name')}</p> : null}
          </div>
          <Field label="Brand" htmlFor="brand">
            <Select
              id="brand"
              value={form.brandId}
              onChange={(event) => set('brandId', event.target.value)}
              disabled={isDisabled}
            >
              <option value="">No brand</option>
              {meta.data?.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="category">
            <Select
              id="category"
              value={form.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
              disabled={isDisabled}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {hasParents ? `${'— '.repeat(category.level)}${category.name}` : category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SKU" htmlFor="sku" hint="Unique code used for tracking.">
            <Input
              id="sku"
              value={form.sku}
              onChange={(event) => set('sku', event.target.value)}
              required
              disabled={isDisabled}
            />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={form.status}
              onChange={(event) => set('status', event.target.value)}
              disabled={isDisabled}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & inventory</CardTitle>
          <CardDescription>
            Prices are stored as USD. Use inventory adjustments to change stock levels.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Price (USD) *" htmlFor="price">
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(event) => set('price', event.target.value)}
              required
              disabled={isDisabled}
            />
          </Field>
          <Field label="Compare-at price (USD)" htmlFor="compareAt">
            <Input
              id="compareAt"
              type="number"
              step="0.01"
              min="0"
              value={form.compareAt}
              onChange={(event) => set('compareAt', event.target.value)}
              disabled={isDisabled}
            />
          </Field>
          {!productId ? (
            <Field label="Initial stock" htmlFor="stock" hint="Only used when creating.">
              <Input
                id="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) => set('stock', event.target.value)}
                disabled={isDisabled}
              />
            </Field>
          ) : null}
          <Field label="Low stock threshold" htmlFor="threshold">
            <Input
              id="threshold"
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={(event) => set('lowStockThreshold', event.target.value)}
              disabled={isDisabled}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Variants</CardTitle>
            <CardDescription>
              Optional SKU-level options with own pricing and stock.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setForm((current) => ({
                ...current,
                variants: [
                  ...current.variants,
                  { sku: '', optionsText: '', price: '', stock: '0', active: true }
                ]
              }))
            }
          >
            <Plus /> Add variant
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No variants. The product will sell from its single SKU pool.
            </p>
          ) : (
            form.variants.map((variant, index) => (
              <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12">
                <Field label="Options (Name: Value)" htmlFor={`variant-options-${index}`}>
                  <Input
                    id={`variant-options-${index}`}
                    value={variant.optionsText}
                    placeholder="Color: Midnight, Size: M"
                    onChange={(event) => setVariant(index, { optionsText: event.target.value })}
                    disabled={isDisabled}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Label htmlFor={`variant-sku-${index}`} className="text-xs">
                    SKU
                  </Label>
                  <Input
                    id={`variant-sku-${index}`}
                    value={variant.sku}
                    placeholder={form.sku}
                    onChange={(event) => setVariant(index, { sku: event.target.value })}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`variant-price-${index}`} className="text-xs">
                    Price (USD)
                  </Label>
                  <Input
                    id={`variant-price-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={variant.price}
                    onChange={(event) => setVariant(index, { price: event.target.value })}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`variant-stock-${index}`} className="text-xs">
                    Stock
                  </Label>
                  <Input
                    id={`variant-stock-${index}`}
                    type="number"
                    min="0"
                    step="1"
                    value={variant.stock}
                    onChange={(event) => setVariant(index, { stock: event.target.value })}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end gap-3 sm:col-span-3">
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={variant.active}
                      onChange={(event) => setVariant(index, { active: event.target.checked })}
                      disabled={isDisabled}
                      className="size-4 rounded border-input"
                    />
                    Active
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove variant"
                    className="mb-1"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        variants: current.variants.filter(
                          (_, variantIndex) => variantIndex !== index
                        )
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>Short summary and long-form marketing copy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Short description" htmlFor="shortDescription">
            <Input
              id="shortDescription"
              value={form.shortDescription}
              onChange={(event) => set('shortDescription', event.target.value)}
              disabled={isDisabled}
            />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              disabled={isDisabled}
              rows={5}
            />
          </Field>
          <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. bestseller, new">
            <Input
              id="tags"
              value={form.tags}
              onChange={(event) => set('tags', event.target.value)}
              disabled={isDisabled}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Images</CardTitle>
            <CardDescription>
              Image URLs are shown in listings and on product pages.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setForm((current) => ({
                ...current,
                images: [...current.images, { url: '', alt: '' }]
              }))
            }
          >
            <Plus /> Add image
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images yet.</p>
          ) : (
            form.images.map((image, index) => (
              <div
                key={index}
                className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"
              >
                <ImageUpload
                  value={image.url || null}
                  size="sm"
                  disabled={isDisabled}
                  onChange={(url) =>
                    setForm((current) => ({
                      ...current,
                      images: current.images.map((item, imageIndex) =>
                        imageIndex === index ? { ...item, url } : item
                      )
                    }))
                  }
                  onClear={() =>
                    setForm((current) => ({
                      ...current,
                      images: current.images.map((item, imageIndex) =>
                        imageIndex === index ? { ...item, url: '' } : item
                      )
                    }))
                  }
                />
                <Input
                  value={image.url}
                  placeholder="https://… image URL"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      images: current.images.map((item, imageIndex) =>
                        imageIndex === index ? { ...item, url: event.target.value } : item
                      )
                    }))
                  }
                  disabled={isDisabled}
                />
                <Input
                  value={image.alt}
                  placeholder="Alt text"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      images: current.images.map((item, imageIndex) =>
                        imageIndex === index ? { ...item, alt: event.target.value } : item
                      )
                    }))
                  }
                  disabled={isDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove image"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      images: current.images.filter((_, imageIndex) => imageIndex !== index)
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => set('featured', event.target.checked)}
              disabled={isDisabled}
              className="size-4 rounded border-input"
            />
            Feature this product on the homepage
          </label>
          <Button type="submit" disabled={saving || meta.loading}>
            {saving ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
