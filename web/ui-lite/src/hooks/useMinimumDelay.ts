import { useState, useEffect } from 'preact/hooks'

/**
 * Hook to ensure a minimum loading time to prevent UI flicker
 * This prevents the flash when data loads very quickly
 */
export function useMinimumDelay(loading: boolean, minimumMs: number = 300) {
  const [shouldShow, setShouldShow] = useState(loading)
  const [startTime, setStartTime] = useState<number | null>(null)

  useEffect(() => {
    if (loading && startTime === null) {
      setStartTime(Date.now())
      setShouldShow(true)
    } else if (!loading && startTime !== null) {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minimumMs - elapsed)
      
      setTimeout(() => {
        setShouldShow(false)
        setStartTime(null)
      }, remaining)
    }
  }, [loading, startTime, minimumMs])

  return shouldShow
}