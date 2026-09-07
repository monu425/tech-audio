import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

export function RatingStars({
  value,
  size = 'size-3.5',
  className
}: {
  value: number | null
  size?: string
  className?: string
}) {
  const stars = Math.round(value ?? 0)
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={`${value ?? 0} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={cn(
            size,
            index <= stars ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'
          )}
        />
      ))}
    </span>
  )
}
