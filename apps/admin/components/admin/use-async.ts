'use client'

import * as React from 'react'

import { isApiError } from '@/lib/api'

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

export function useAsync<T>(fetcher: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    // Intentional request lifecycle: reset loading/error before each fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fetcher()
      .then((result) => {
        if (!alive) return
        setData(result)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setError(errorMessage(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = React.useCallback(() => setTick((value) => value + 1), [])

  return { data, loading, error, reload }
}
