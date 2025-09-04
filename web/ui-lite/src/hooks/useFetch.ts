import { useState, useEffect, useCallback, useRef } from 'preact/hooks'

interface CacheEntry<T> {
  data: T
  timestamp: number
  loading: boolean
}

interface FetchOptions {
  staleMs?: number
  revalidate?: boolean
  timeoutMs?: number
}

interface FetchState<T> {
  loading: boolean
  data: T | null
  error: Error | null
  isStale: boolean
  mutate: (data: T) => void
  revalidate: () => Promise<void>
}

// Global in-memory cache
const cache = new Map<string, CacheEntry<any>>()

// SWR-lite implementation
export function useFetch<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: FetchOptions = {}
): FetchState<T> {
  const {
    staleMs = 5000,
    revalidate = true,
    timeoutMs = 8000
  } = options

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isStale, setIsStale] = useState(false)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  // Initialize data from cache if available
  useEffect(() => {
    if (!key) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const cached = cache.get(key)
    if (cached) {
      setData(cached.data)
      setLoading(cached.loading)
      
      const age = Date.now() - cached.timestamp
      setIsStale(age > staleMs)
    } else {
      setData(null)
      setError(null)
      setIsStale(false)
    }
  }, [key, staleMs])

  const executeRequest = useCallback(async (forceRefresh = false) => {
    if (!key) return

    // Check if we should skip fetching (have fresh data and not forcing)
    const cached = cache.get(key)
    if (!forceRefresh && cached && !cached.loading) {
      const age = Date.now() - cached.timestamp
      if (age <= staleMs) {
        return // Data is still fresh
      }
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }, timeoutMs)

    try {
      // Update loading state
      if (mounted.current) {
        setLoading(true)
        setError(null)
      }
      
      // Update cache loading state
      cache.set(key, {
        data: cached?.data || null,
        timestamp: cached?.timestamp || 0,
        loading: true
      })

      const result = await fetcher(abortControllerRef.current.signal)
      
      clearTimeout(timeoutId)
      
      // Only update if component is still mounted and request wasn't aborted
      if (mounted.current && !abortControllerRef.current.signal.aborted) {
        setData(result)
        setError(null)
        setLoading(false)
        setIsStale(false)
        
        // Update cache
        cache.set(key, {
          data: result,
          timestamp: Date.now(),
          loading: false
        })
      }
    } catch (err) {
      clearTimeout(timeoutId)
      
      // Only update error if component is still mounted and request wasn't aborted
      if (mounted.current && !abortControllerRef.current.signal.aborted) {
        setError(err instanceof Error ? err : new Error('Fetch failed'))
        setLoading(false)
        
        // Update cache to mark as not loading
        if (cached) {
          cache.set(key, {
            ...cached,
            loading: false
          })
        }
      }
    }
  }, [key, fetcher, staleMs, timeoutMs])

  // Manual mutation function
  const mutate = useCallback((newData: T) => {
    if (!key) return
    
    setData(newData)
    setError(null)
    setIsStale(false)
    
    // Update cache
    cache.set(key, {
      data: newData,
      timestamp: Date.now(),
      loading: false
    })
  }, [key])

  // Manual revalidation
  const revalidateFunc = useCallback(async () => {
    await executeRequest(true)
  }, [executeRequest])

  // Effect for initial load and revalidation
  useEffect(() => {
    if (!key) return

    // Immediate load
    executeRequest()

    // Set up revalidation if enabled
    if (!revalidate) return

    const interval = setInterval(() => {
      const cached = cache.get(key)
      if (cached && !cached.loading) {
        const age = Date.now() - cached.timestamp
        if (age > staleMs) {
          setIsStale(true)
          executeRequest()
        }
      }
    }, staleMs)

    return () => clearInterval(interval)
  }, [key, executeRequest, revalidate, staleMs])

  // Cleanup on unmount
  useEffect(() => {
    mounted.current = true
    
    return () => {
      mounted.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    loading,
    data,
    error,
    isStale,
    mutate,
    revalidate: revalidateFunc
  }
}

// Cache management utilities
export const fetchCache = {
  // Clear specific key
  invalidate: (key: string) => {
    cache.delete(key)
  },
  
  // Clear all cache
  clear: () => {
    cache.clear()
  },
  
  // Get cache size
  size: () => cache.size,
  
  // Get cache keys
  keys: () => Array.from(cache.keys()),
  
  // Manually set cache entry
  set: <T>(key: string, data: T) => {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      loading: false
    })
  }
}

// Hook for legacy compatibility with existing useApiData
export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const cacheKey = fetcher.toString() + JSON.stringify(deps)
  
  const { data, loading, error, revalidate } = useFetch(
    cacheKey,
    (signal) => fetcher(),
    { staleMs: 30000 } // 30 second default staleness for compatibility
  )

  return {
    data,
    loading,
    error,
    refetch: revalidate
  }
}