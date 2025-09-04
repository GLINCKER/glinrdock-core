import { useState, useEffect, useCallback, useRef } from 'preact/hooks'

export interface AsyncState<T> {
  loading: boolean
  data: T | null
  error: Error | null
  retry: () => void
}

// Generic async hook with abort support
export function useAsync<T>(
  asyncFunction: (signal: AbortSignal) => Promise<T>,
  deps: any[] = []
): AsyncState<T> {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const execute = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()
    
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFunction(abortControllerRef.current.signal)
      
      // Only update state if this request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setData(result)
        setLoading(false)
      }
    } catch (err) {
      // Only update error state if this request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setLoading(false)
      }
    }
  }, deps)

  const retry = useCallback(() => {
    execute()
  }, [execute])

  useEffect(() => {
    execute()

    // Cleanup function to abort request on unmount or deps change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, deps)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return { loading, data, error, retry }
}