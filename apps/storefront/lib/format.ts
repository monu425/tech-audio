export function formatMoney(minor: number, currency = 'USD'): string {
  const value = Number(minor ?? 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}

export function formatMoneySigned(minor: number, currency = 'USD'): string {
  const value = Number(minor ?? 0) / 100
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatMoney(Math.abs(minor ?? 0), currency)}`
}

export function discountPercent(
  compareAtMinor: number | null,
  priceMinor: number | null
): number | null {
  if (!compareAtMinor || !priceMinor || compareAtMinor <= priceMinor) return null
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatStockStatus(status: string | null): {
  label: string
  tone: 'green' | 'amber' | 'red'
} {
  switch (status) {
    case 'in_stock':
      return { label: 'In stock', tone: 'green' }
    case 'low_stock':
      return { label: 'Low stock', tone: 'amber' }
    case 'out_of_stock':
      return { label: 'Out of stock', tone: 'red' }
    default:
      return { label: 'Unavailable', tone: 'red' }
  }
}
