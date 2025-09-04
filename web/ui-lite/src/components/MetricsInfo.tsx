import { formatTimeAgo, formatDuration } from '../utils/timeFormat'

interface MetricsInfoProps {
  historicalMetrics?: any
  selectedTimeRange: string
  dataUpdateCount: number
  lastRefresh: Date
  renderTime: number
  isAutoRefreshEnabled: boolean
  isPaused: boolean
  autoRefreshInterval: number
  refreshIntervals: { value: number; label: string }[]
}

export function MetricsInfo({
  historicalMetrics,
  selectedTimeRange,
  dataUpdateCount,
  lastRefresh,
  renderTime,
  isAutoRefreshEnabled,
  isPaused,
  autoRefreshInterval,
  refreshIntervals
}: MetricsInfoProps) {
  const getMetricsDescription = () => {
    if (!historicalMetrics?.metrics?.length) {
      return `Historical metrics • ${selectedTimeRange.toUpperCase()} range`
    }

    const metrics = historicalMetrics.metrics
    const oldestData = new Date(metrics[0].timestamp)
    const newestData = new Date(metrics[metrics.length - 1].timestamp)
    const actualCoverage = (newestData.getTime() - oldestData.getTime()) / (1000 * 60 * 60)
    const requestedHours = selectedTimeRange === '1h' ? 1 : selectedTimeRange === '24h' ? 24 : 168
    const coveragePercent = Math.min(100, (actualCoverage / requestedHours) * 100)
    
    if (coveragePercent < 95) {
      return `${metrics.length} points • ${formatDuration(actualCoverage)} of ${selectedTimeRange.toUpperCase()} (${coveragePercent.toFixed(0)}% coverage)`
    }
    
    return `${metrics.length} data points • ${selectedTimeRange.toUpperCase()} range`
  }

  return (
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      {getMetricsDescription()}
    </div>
  )
}

interface MetricsStatusProps {
  lastRefresh: Date
  dataUpdateCount: number
  renderTime: number
  isAutoRefreshEnabled: boolean
  isPaused: boolean
  autoRefreshInterval: number
  refreshIntervals: { value: number; label: string }[]
}

export function MetricsStatus({
  lastRefresh,
  dataUpdateCount,
  renderTime,
  isAutoRefreshEnabled,
  isPaused,
  autoRefreshInterval,
  refreshIntervals
}: MetricsStatusProps) {
  return (
    <>
      <span class="text-xs text-gray-500">Updated: {lastRefresh.toLocaleTimeString()}</span>
      <span class="text-xs text-gray-500" title="Data refresh count">v{dataUpdateCount}</span>
      {renderTime > 0 && (
        <span class="text-xs text-gray-500" title="Chart render time">
          • {renderTime}ms
        </span>
      )}
      {isAutoRefreshEnabled && !isPaused && (
        <span class="flex items-center gap-1 text-xs text-gray-500" title="Auto-refresh active">
          • Auto: {refreshIntervals.find(r => r.value === autoRefreshInterval)?.label}
          <svg class="w-2.5 h-2.5 animate-pulse text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
      )}
      {isPaused && (
        <span class="text-xs text-red-400" title="Data refresh is paused">• Paused</span>
      )}
    </>
  )
}