import { useEffect, useRef, useState } from 'preact/hooks'
import { apiClient, useApiData } from '../../../api'
import { Eye, EyeOff } from 'lucide-preact'
import { MetricsInfo, MetricsStatus } from '../../../components/MetricsInfo'
import { formatTimeAgo } from '../../../utils/timeFormat'

interface SimpleChartsProps {
  systemMetrics?: any
}

type TimeRange = '1h' | '24h' | '7d'

interface TimeRangeOption {
  value: TimeRange
  label: string
  duration: string
}

export function SimpleCharts({ systemMetrics }: SimpleChartsProps) {
  const cpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const memoryCanvasRef = useRef<HTMLCanvasElement>(null)
  const networkCanvasRef = useRef<HTMLCanvasElement>(null)
  const loadCanvasRef = useRef<HTMLCanvasElement>(null)
  const processesCanvasRef = useRef<HTMLCanvasElement>(null)
  
  // Time range state
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1h')
  
  // Pause/resume state for data loading
  const [isPaused, setIsPaused] = useState(false)
  
  // Auto-refresh state and options
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000) // Default 5 seconds for testing
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true)
  
  // Refresh interval options
  const refreshIntervals = [
    { value: 3000, label: '3s' },
    { value: 5000, label: '5s' },
    { value: 10000, label: '10s' },
    { value: 15000, label: '15s' },
    { value: 30000, label: '30s' },
    { value: 60000, label: '1m' },
    { value: 300000, label: '5m' }
  ]
  
  // Time range options
  const timeRangeOptions: TimeRangeOption[] = [
    { value: '1h', label: '1H', duration: '1h' },
    { value: '24h', label: '24H', duration: '24h' },
    { value: '7d', label: '7D', duration: '168h' }
  ]
  
  // State for historical metrics
  const [historicalMetrics, setHistoricalMetrics] = useState(null)
  const [historicalLoading, setHistoricalLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [dataUpdateCount, setDataUpdateCount] = useState(0)
  const [forceChartUpdate, setForceChartUpdate] = useState(0)
  
  // Performance monitoring
  const [renderTime, setRenderTime] = useState(0)
  const [lastRenderStart, setLastRenderStart] = useState(0)
  
  // UI State
  const [showDetails, setShowDetails] = useState(false)
  const [currentNetworkRate, setCurrentNetworkRate] = useState(0)
  const [currentCpuPercent, setCurrentCpuPercent] = useState(0)
  
  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    content: string
    chart: string
  }>({ visible: false, x: 0, y: 0, content: '', chart: '' })
  
  // Page visibility state
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden)

  // Page Visibility API - pause data loading when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Fetch historical metrics data based on selected time range
  useEffect(() => {
    if (isPaused) {
      setHistoricalLoading(false)
      return
    }
    
    const fetchMetrics = async () => {
      try {
        setHistoricalLoading(true)
        const duration = timeRangeOptions.find(opt => opt.value === selectedTimeRange)?.duration
        const data = await apiClient.getLatestHistoricalMetrics(1000, duration)
        // Deep copy to ensure React detects changes
        const newMetrics = {
          ...data,
          metrics: data.metrics ? [...data.metrics] : []
        }
        setHistoricalMetrics(newMetrics)
        setLastRefresh(new Date())
        setDataUpdateCount(prev => prev + 1)
        setForceChartUpdate(prev => prev + 1)
      } catch (error) {
        setHistoricalMetrics(null) // Explicitly set to null on error to trigger fallback
      } finally {
        setHistoricalLoading(false)
      }
    }

    fetchMetrics()
  }, [selectedTimeRange, isPaused])

  // Auto-refresh timer
  useEffect(() => {
    if (isPaused || !isAutoRefreshEnabled || !isPageVisible) return
    
    const intervalId = setInterval(() => {
      if (!isPaused && isAutoRefreshEnabled && isPageVisible) {
        const duration = timeRangeOptions.find(opt => opt.value === selectedTimeRange)?.duration
        apiClient.getLatestHistoricalMetrics(1000, duration)
          .then(data => {
            // Deep copy to ensure React detects changes
            const newMetrics = {
              ...data,
              metrics: data.metrics ? [...data.metrics] : []
            }
            setHistoricalMetrics(newMetrics)
            setLastRefresh(new Date())
            setDataUpdateCount(prev => prev + 1)
            setForceChartUpdate(prev => prev + 1)
            
            // Update current CPU percent from latest data if available
            if (data.metrics && data.metrics.length > 0) {
              const latestMetric = data.metrics[data.metrics.length - 1]
              if (latestMetric.cpu_percent !== undefined) {
                setCurrentCpuPercent(latestMetric.cpu_percent)
              }
            }
          })
          .catch(error => {})
      }
    }, autoRefreshInterval)

    return () => clearInterval(intervalId)
  }, [autoRefreshInterval, isPaused, isAutoRefreshEnabled, selectedTimeRange, isPageVisible])

  // Cleanup effect for canvas event listeners
  useEffect(() => {
    return () => {
      // Clean up canvas event listeners on unmount
      [cpuCanvasRef, memoryCanvasRef, networkCanvasRef, loadCanvasRef, processesCanvasRef].forEach(ref => {
        if (ref.current) {
          const canvas = ref.current
          canvas.removeEventListener('mousemove', canvas.onmousemove as any)
          canvas.removeEventListener('mouseleave', canvas.onmouseleave as any)
        }
      })
      
      // Hide tooltip on unmount
      setTooltip(prev => ({ ...prev, visible: false }))
    }
  }, [])

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }


  // Mini chart drawing function for performance metrics
  const drawMiniChart = (canvas: HTMLCanvasElement, data: number[], color: string, maxValue?: number, originalMetrics?: any[]) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get the display size from CSS
    const rect = canvas.getBoundingClientRect()
    const displayWidth = rect.width || 120
    const displayHeight = rect.height || 20
    
    // Set up canvas for high DPI - modern 2024 approach
    const dpr = window.devicePixelRatio || 1
    
    // Set the actual size in memory (scaled up for high DPI)
    canvas.width = Math.floor(displayWidth * dpr)
    canvas.height = Math.floor(displayHeight * dpr)
    
    // Scale the CSS size back down to the intended display size
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'
    
    // Scale the drawing context so everything draws at the correct size
    ctx.scale(dpr, dpr)
    
    // Clear canvas and use display dimensions for all calculations
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    if (data.length === 0) return

    const width = displayWidth
    const height = displayHeight
    const padding = 2
    const chartWidth = Math.max(width - (padding * 2), 5)
    const chartHeight = Math.max(height - (padding * 2), 5)
    
    const max = maxValue || Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, color + '40')
    gradient.addColorStop(1, color + '10')

    // Draw area
    ctx.beginPath()
    ctx.moveTo(padding, height - padding)
    
    data.forEach((value, index) => {
      const x = padding + (data.length > 1 ? (index / (data.length - 1)) * chartWidth : chartWidth / 2)
      const clampedValue = Math.max(min, Math.min(max, value))
      const y = height - padding - ((clampedValue - min) / range) * chartHeight
      ctx.lineTo(x, y)
    })
    
    ctx.lineTo(width - padding, height - padding)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw line with consistent thickness
    ctx.beginPath()
    data.forEach((value, index) => {
      const x = padding + (data.length > 1 ? (index / (data.length - 1)) * chartWidth : chartWidth / 2)
      const clampedValue = Math.max(min, Math.min(max, value))
      const y = height - padding - ((clampedValue - min) / range) * chartHeight
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 1 // Fixed line width for mini charts
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const drawChart = (canvas: HTMLCanvasElement, data: number[], color: string, label: string, originalMetrics?: any[]) => {
    // Safety guards
    if (!canvas || !data || !Array.isArray(data) || data.length === 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    // Get the display size from CSS
    const rect = canvas.getBoundingClientRect()
    const displayWidth = rect.width || 300
    const displayHeight = rect.height || 120
  
    // Set up canvas for high DPI
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = Math.floor(displayWidth * dpr)
    canvas.height = Math.floor(displayHeight * dpr)
    
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'
    
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, displayWidth, displayHeight)
    
    const width = displayWidth
    const height = displayHeight

    // Performance protection: sample large datasets
    let sampledData = [...data]
    const maxPoints = 200
    if (sampledData.length > maxPoints) {
      const step = Math.ceil(sampledData.length / maxPoints)
      sampledData = sampledData.filter((_, index) => index % step === 0 || index === sampledData.length - 1)
    }

    // Data validation
    sampledData = sampledData.filter(val => 
      typeof val === 'number' && !isNaN(val) && isFinite(val)
    )
    
    if (sampledData.length === 0) {
      return
    }

    // Calculate range
    const minValue = Math.min(...sampledData, 0)
    const maxValue = Math.max(...sampledData, 1)
    const valueRange = maxValue - minValue
    const safeRange = Math.max(0.001, valueRange)

    const padding = 25
    const chartWidth = Math.max(width - (padding * 2), 10)
    const chartHeight = Math.max(height - (padding * 2), 10)

    // Set up clipping region
    ctx.save()
    ctx.rect(padding, padding, chartWidth, chartHeight)
    ctx.clip()
    

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding)
    gradient.addColorStop(0, color + '40')
    gradient.addColorStop(1, color + '00')

    // Helper function to normalize Y coordinates
    const normalizeY = (value: number) => {
      const clampedValue = Math.max(minValue, Math.min(maxValue, value))
      const normalizedValue = (clampedValue - minValue) / safeRange
      const y = height - padding - normalizedValue * chartHeight
      return Math.max(padding, Math.min(height - padding, y))
    }

    // Draw area chart
    ctx.beginPath()
    ctx.moveTo(padding, height - padding)
    
    sampledData.forEach((value, index) => {
      const x = padding + (sampledData.length > 1 ? (index / (sampledData.length - 1)) * chartWidth : chartWidth / 2)
      const y = normalizeY(value)
      ctx.lineTo(x, y)
    })
    
    ctx.lineTo(width - padding, height - padding)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw line
    ctx.beginPath()
    sampledData.forEach((value, index) => {
      const x = padding + (sampledData.length > 1 ? (index / (sampledData.length - 1)) * chartWidth : chartWidth / 2)
      const y = normalizeY(value)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Restore context
    ctx.restore()
    
    // Add hover functionality with cleanup
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      
      let nearestPoint = null
      let minDistance = 15
      
      sampledData.forEach((value, index) => {
        const x = padding + (sampledData.length > 1 ? (index / (sampledData.length - 1)) * chartWidth : chartWidth / 2)
        const y = normalizeY(value)
        
        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2)
        if (distance < minDistance) {
          nearestPoint = { value, index, x, y }
          minDistance = distance
        }
      })
      
      if (nearestPoint) {
        const formatValue = label === 'Network' 
          ? `${nearestPoint.value.toFixed(2)} Mbps`
          : `${Math.round(nearestPoint.value)}%`
        
        const timeOffset = sampledData.length - nearestPoint.index - 1
        // Get timestamp from original metrics if available
        const actualTimestamp = originalMetrics?.[nearestPoint.index]?.timestamp
        const timeAgo = actualTimestamp ? formatTimeAgo(actualTimestamp) : 
          (timeOffset === 0 ? 'now' : `${timeOffset} points ago`)
        
        setTooltip({
          visible: true,
          x: event.clientX + 10,
          y: event.clientY - 10,
          content: `${label}: ${formatValue}\n${timeAgo}`,
          chart: label
        })
        canvas.style.cursor = 'pointer'
      } else {
        setTooltip(prev => ({ ...prev, visible: false }))
        canvas.style.cursor = 'default'
      }
    }
    
    const handleMouseLeave = () => {
      setTooltip(prev => ({ ...prev, visible: false }))
      canvas.style.cursor = 'default'
    }

    // Remove existing listeners
    canvas.removeEventListener('mousemove', canvas.onmousemove as any)
    canvas.removeEventListener('mouseleave', canvas.onmouseleave as any)
    
    // Add new listeners
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    
    // Store cleanup functions
    canvas.onmousemove = handleMouseMove as any
    canvas.onmouseleave = handleMouseLeave as any
  }

  useEffect(() => {
    if (!systemMetrics || !cpuCanvasRef.current || !memoryCanvasRef.current || !networkCanvasRef.current) return

    // Performance monitoring
    const renderStartTime = performance.now()
    setLastRenderStart(renderStartTime)


    if (historicalMetrics && historicalMetrics.metrics && historicalMetrics.metrics.length > 0) {
      // Use real historical data
      const metrics = historicalMetrics.metrics
      
      // Check actual data coverage
      const oldestData = new Date(metrics[0].timestamp)
      const newestData = new Date(metrics[metrics.length - 1].timestamp)
      const actualCoverage = (newestData.getTime() - oldestData.getTime()) / (1000 * 60 * 60) // hours
      
      
      
      // CPU Chart - extract CPU percentages from historical data
      const cpuData = metrics.map(m => m.cpu_percent)
      // Use the latest historical value for consistency (don't mix with potentially incorrect system metrics)
      const latestHistoricalCpu = cpuData[cpuData.length - 1]
      setCurrentCpuPercent(latestHistoricalCpu)
      drawChart(cpuCanvasRef.current, cpuData, '#10b981', 'CPU', metrics)

      // Memory Chart - calculate memory percentages from historical data
      const memoryData = metrics.map(m => (m.memory_used / m.memory_total) * 100)
      // Add current value if available  
      if (systemMetrics.resources?.memory?.used_percent !== undefined) {
        memoryData.push(systemMetrics.resources.memory.used_percent)
      }
      drawChart(memoryCanvasRef.current, memoryData, '#3b82f6', 'Memory', metrics)

      // Network Chart - calculate actual network rates (bytes per second)
      // Calculate rate by comparing consecutive data points
      const networkRates = []
      for (let i = 1; i < metrics.length; i++) {
        const timeDiff = (new Date(metrics[i].timestamp).getTime() - new Date(metrics[i-1].timestamp).getTime()) / 1000 // seconds
        const bytesDiff = metrics[i].network_rx - metrics[i-1].network_rx
        const bytesPerSecond = timeDiff > 0 ? bytesDiff / timeDiff : 0
        const mbps = (bytesPerSecond * 8) / (1024 * 1024) // Convert to Mbps (bytes * 8 bits / 1024^2)
        networkRates.push(Math.max(0, mbps)) // Ensure non-negative values
      }
      
      // If we don't have enough data points for rate calculation, use cumulative values as approximation
      if (networkRates.length === 0) {
        metrics.forEach(m => {
          const mbps = (m.network_rx * 8) / (1024 * 1024) // Rough approximation from cumulative
          networkRates.push(mbps)
        })
      }
      
      // Update current network rate (latest value)
      const latestRate = networkRates.length > 0 ? networkRates[networkRates.length - 1] : 0
      setCurrentNetworkRate(latestRate)
      
      const maxRateMbps = Math.max(...networkRates, 0.001)
      drawChart(networkCanvasRef.current, networkRates, '#f59e0b', 'Network', metrics)

      // Mini charts for performance metrics
      if (loadCanvasRef.current) {
        const loadData = [
          ...(systemMetrics?.performance?.load_average || [0, 0, 0]),
          systemMetrics?.performance?.load_average?.[0] || 0
        ]
        drawMiniChart(loadCanvasRef.current, loadData, '#8b5cf6')
      }

      if (processesCanvasRef.current) {
        // Show current processes count, but wait for historical data for trend
        const currentProcesses = systemMetrics?.performance?.active_processes || 0
        if (processesCanvasRef.current) {
          const canvas = processesCanvasRef.current
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = 'rgba(6, 182, 212, 0.6)'
            ctx.font = '11px system-ui'
            ctx.textAlign = 'center'
            ctx.fillText(`${currentProcesses} processes`, canvas.width / 2, canvas.height / 2)
          }
        }
      }
    } else {
      // Use current system values for display but wait for historical data to render charts
      setCurrentCpuPercent(systemMetrics.resources.cpu.used_percent)
      setCurrentNetworkRate(systemMetrics.resources.network.rx_rate || 0)
      
      // Show loading state on charts until historical data is available
      const clearCanvas = (canvas: HTMLCanvasElement | null) => {
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
            ctx.font = '12px system-ui'
            ctx.textAlign = 'center'
            ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2)
          }
        }
      }
      
      clearCanvas(cpuCanvasRef.current)
      clearCanvas(memoryCanvasRef.current)
      clearCanvas(networkCanvasRef.current)
      clearCanvas(loadCanvasRef.current)
      clearCanvas(processesCanvasRef.current)
    }
    
    // Complete performance monitoring
    const renderEndTime = performance.now()
    const totalRenderTime = Math.round(renderEndTime - renderStartTime)
    setRenderTime(totalRenderTime)
    
  }, [systemMetrics, historicalMetrics, selectedTimeRange, dataUpdateCount, forceChartUpdate])

  if (!systemMetrics) {
    return (
      <div class="grid lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} class="card gradient-card shadow-lg">
            <div class="skeleton h-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div class="space-y-6 relative">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">
            <span class="bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
              Resource Performance
            </span>
          </h2>
          {showDetails && (
            <MetricsInfo
              historicalMetrics={historicalMetrics}
              selectedTimeRange={selectedTimeRange}
              dataUpdateCount={dataUpdateCount}
              lastRefresh={lastRefresh}
              renderTime={renderTime}
              isAutoRefreshEnabled={isAutoRefreshEnabled}
              isPaused={isPaused}
              autoRefreshInterval={autoRefreshInterval}
              refreshIntervals={refreshIntervals}
            />
          )}
          <div class="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              class="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-500/20 hover:bg-gray-500/30 transition-colors"
              title={showDetails ? 'Hide details' : 'Show details'}
            >
              {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            {showDetails && (
              <MetricsStatus
                lastRefresh={lastRefresh}
                dataUpdateCount={dataUpdateCount}
                renderTime={renderTime}
                isAutoRefreshEnabled={isAutoRefreshEnabled}
                isPaused={isPaused}
                autoRefreshInterval={autoRefreshInterval}
                refreshIntervals={refreshIntervals}
              />
            )}
          </div>
        </div>
        
        {/* Time Range Selector and Controls */}
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div class="flex items-center gap-3">
            {/* Auto-refresh Toggle */}
            <button
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              class={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                isAutoRefreshEnabled
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
              title={isAutoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              <svg class={`w-3 h-3 ${isAutoRefreshEnabled ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Auto
            </button>
            
            {/* Refresh Interval Selector */}
            {isAutoRefreshEnabled && (
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                disabled={isPaused}
                class="px-2 py-1.5 text-xs font-medium bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-md border border-white/20 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {refreshIntervals.map((interval) => (
                  <option key={interval.value} value={interval.value} class="bg-white dark:bg-gray-800">
                    {interval.label}
                  </option>
                ))}
              </select>
            )}
            
            {/* Pause/Resume Button */}
            <button
            onClick={() => setIsPaused(!isPaused)}
            class={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              isPaused
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
            title={isPaused ? 'Resume data loading' : 'Pause data loading'}
          >
            {isPaused ? (
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          
          {/* Manual Refresh Button */}
          <button
            onClick={() => {
              if (!isPaused) {
                const duration = timeRangeOptions.find(opt => opt.value === selectedTimeRange)?.duration
                setHistoricalLoading(true)
                apiClient.getLatestHistoricalMetrics(1000, duration)
                  .then(data => {
                    // Deep copy to ensure React detects changes
                    const newMetrics = {
                      ...data,
                      metrics: data.metrics ? [...data.metrics] : []
                    }
                    setHistoricalMetrics(newMetrics)
                    setLastRefresh(new Date())
                    setDataUpdateCount(prev => prev + 1)
                    setForceChartUpdate(prev => prev + 1)
                    
                    // Update current CPU percent from latest data if available
                    if (data.metrics && data.metrics.length > 0) {
                      const latestMetric = data.metrics[data.metrics.length - 1]
                      if (latestMetric.cpu_percent !== undefined) {
                        setCurrentCpuPercent(latestMetric.cpu_percent)
                      }
                    }
                  })
                  .finally(() => setHistoricalLoading(false))
              }
            }}
            disabled={isPaused || historicalLoading}
            class={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              isPaused || historicalLoading
                ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
            }`}
            title="Manual refresh"
          >
            <svg class={`w-3 h-3 ${historicalLoading ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
          </div>
          
          {/* Time Range Selector Component */}
          <div class="flex items-center gap-1 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-1">
            {timeRangeOptions.map((option) => {
              
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedTimeRange(option.value)}
                  disabled={isPaused}
                  class={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 relative ${
                    selectedTimeRange === option.value
                      ? 'bg-gradient-to-r from-[#10b981] to-[#3b82f6] text-white shadow-lg'
                      : isPaused
                      ? 'text-gray-500 dark:text-gray-600 cursor-not-allowed'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
            {historicalLoading && !isPaused && (
              <div class="ml-2 w-4 h-4 border-2 border-[#10b981]/30 border-t-[#10b981] rounded-full animate-spin"></div>
            )}
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        {/* CPU Usage Chart */}
        <div class="card gradient-card shadow-lg shadow-[#10b981]/20">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-[#10b981]/20 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">CPU Usage</h3>
                <p class="text-lg font-bold text-[#10b981]">
                  {(() => {
                    const displayValue = historicalMetrics && historicalMetrics.metrics && historicalMetrics.metrics.length > 0 
                      ? historicalMetrics.metrics[historicalMetrics.metrics.length - 1].cpu_percent
                      : systemMetrics.resources.cpu.used_percent;
                    return displayValue?.toFixed(1);
                  })()}%
                  {showDetails && <span class="text-xs text-gray-500 ml-2">v{dataUpdateCount}</span>}
                </p>
              </div>
            </div>
          </div>
          <div class="relative w-full h-30 overflow-hidden rounded" style="min-height: 120px;">
            <canvas ref={cpuCanvasRef} class="absolute inset-0 w-full h-full block" />
          </div>
        </div>

        {/* Memory Usage Chart */}
        <div class="card gradient-card shadow-lg shadow-[#3b82f6]/20">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-[#3b82f6]/20 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Memory</h3>
                <p class="text-lg font-bold text-[#3b82f6]">
                  {formatBytes(systemMetrics.resources.memory.used)}
                </p>
              </div>
            </div>
          </div>
          <div class="relative w-full h-30 overflow-hidden rounded" style="min-height: 120px;">
            <canvas ref={memoryCanvasRef} class="absolute inset-0 w-full h-full block" />
          </div>
        </div>

        {/* Network I/O Chart - Placeholder */}
        <div class="card gradient-card shadow-lg shadow-[#f59e0b]/20">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-[#f59e0b]/20 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Network Rate</h3>
                <p class="text-lg font-bold text-[#f59e0b]">
                  {currentNetworkRate.toFixed(2)} Mbps
                  {showDetails && <span class="text-xs text-gray-500 ml-2">v{dataUpdateCount}</span>}
                </p>
              </div>
            </div>
          </div>
          <div class="relative w-full h-30 overflow-hidden rounded" style="min-height: 120px;">
            <canvas ref={networkCanvasRef} class="absolute inset-0 w-full h-full block" />
          </div>
        </div>
      </div>

      {/* Compact Performance Overview */}
      <div class="grid lg:grid-cols-4 gap-4">
        {/* Storage Usage - Compact */}
        <div class="card gradient-card shadow-lg shadow-[#f59e0b]/20">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-[#f59e0b]">Storage</h3>
            <div class="text-lg font-bold text-[#f59e0b]">
              {systemMetrics.resources.disk.used_percent.toFixed(0)}%
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {formatBytes(systemMetrics.resources.disk.used)} / {formatBytes(systemMetrics.resources.disk.total)}
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              class="bg-[#f59e0b] h-1.5 rounded-full" 
              style={{ width: `${Math.min(systemMetrics.resources.disk.used_percent, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Load Average - Mini Chart */}
        <div class="card gradient-card shadow-lg shadow-[#8b5cf6]/20">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-[#8b5cf6]">Load Avg</h3>
            <div class="text-lg font-bold text-[#8b5cf6]">
              {systemMetrics?.performance?.load_average ? systemMetrics.performance.load_average[0].toFixed(1) : '--'}
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {systemMetrics?.performance?.load_average 
              ? `${systemMetrics.performance.load_average[0].toFixed(1)}, ${systemMetrics.performance.load_average[1].toFixed(1)}, ${systemMetrics.performance.load_average[2].toFixed(1)}`
              : '-- , -- , --'
            }
          </div>
          <div class="relative w-full h-5 overflow-hidden rounded" style="min-height: 20px;">
            <canvas ref={loadCanvasRef} class="absolute inset-0 w-full h-full block opacity-80" />
          </div>
        </div>

        {/* Active Processes - Mini Chart */}
        <div class="card gradient-card shadow-lg shadow-[#06b6d4]/20">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-[#06b6d4]">Processes</h3>
            <div class="text-lg font-bold text-[#06b6d4]">
              {systemMetrics?.performance?.active_processes ?? '---'}
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Active system processes
          </div>
          <div class="relative w-full h-5 overflow-hidden rounded" style="min-height: 20px;">
            <canvas ref={processesCanvasRef} class="absolute inset-0 w-full h-full block opacity-80" />
          </div>
        </div>

        {/* File Descriptors - Progress */}
        <div class="card gradient-card shadow-lg shadow-[#ec4899]/20">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-[#ec4899]">File Desc</h3>
            <div class="text-lg font-bold text-[#ec4899]">
              {systemMetrics?.performance?.file_descriptors 
                ? Math.round((systemMetrics.performance.file_descriptors.used / systemMetrics.performance.file_descriptors.max) * 100)
                : 0}%
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {systemMetrics?.performance?.file_descriptors 
              ? `${systemMetrics.performance.file_descriptors.used} / ${systemMetrics.performance.file_descriptors.max}`
              : '--- / ---'
            }
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              class="bg-[#ec4899] h-1.5 rounded-full" 
              style={{ 
                width: `${systemMetrics?.performance?.file_descriptors 
                  ? Math.min((systemMetrics.performance.file_descriptors.used / systemMetrics.performance.file_descriptors.max) * 100, 100)
                  : 0}%` 
              }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Lightweight Hover Tooltip */}
      {tooltip.visible && (
        <div 
          class="fixed z-50 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl border border-gray-700 pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div class="whitespace-pre-line">{tooltip.content}</div>
          <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
        </div>
      )}
    </div>
  )
}