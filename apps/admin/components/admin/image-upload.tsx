'use client'

import * as React from 'react'
import { Loader2, Upload, X } from 'lucide-react'

import { errorMessage } from '@/components/admin/use-async'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ImageUpload({
  value,
  onChange,
  onClear,
  disabled,
  className,
  size = 'default'
}: {
  value: string | null
  onChange: (url: string) => void
  onClear?: () => void
  disabled?: boolean
  className?: string
  size?: 'default' | 'sm'
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const payload = await request<{ url: string }>('/media/images', {
        method: 'POST',
        body,
        rawBody: true
      })
      onChange(payload.url)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const frame = size === 'sm' ? 'size-10 rounded-md' : 'size-14 rounded-lg'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => void pick(event)}
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={cn('border object-cover', frame)} />
      ) : (
        <div className={cn('border bg-muted/40', frame)} />
      )}
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Upload
      </Button>
      {value && onClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove image"
          disabled={disabled}
          onClick={onClear}
        >
          <X className="size-4" />
        </Button>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
