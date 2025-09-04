import { useEffect, useRef, useState } from 'preact/hooks'
import { createChart, ColorType, LineStyle, LineData } from 'lightweight-charts'

interface ResourceGraphsProps {
  systemMetrics?: any
}

export function ResourceGraphs({ systemMetrics }: ResourceGraphsProps) {
  const cpuChartRef = useRef<HTMLDivElement>(null)
  const memoryChartRef = useRef<HTMLDivElement>(null)
  const networkChartRef = useRef<HTMLDivElement>(null)
  const [charts, setCharts] = useState<any>({})

  // Generate mock historical data for demonstration
  const generateMockData = (baseValue: number, variance = 10) => {
    const data = []
    const now = Math.floor(Date.now() / 1000)
    
    for (let i = 59; i >= 0; i--) {
      const time = now - (i * 60) // Last 60 minutes, 1 minute intervals
      const variation = (Math.random() - 0.5) * variance
      const value = Math.max(0, Math.min(100, baseValue + variation))
      data.push({ time, value })
    }
    return data
  }

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  useEffect(() => {
    if (!systemMetrics || !cpuChartRef.current || !memoryChartRef.current || !networkChartRef.current) return

    try {
      // Common chart options
      const chartOptions = {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: '#374151', style: LineStyle.Dotted },
          horzLines: { color: '#374151', style: LineStyle.Dotted },
        },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderColor: '#4b5563',
        },
        timeScale: {
          borderColor: '#4b5563',
          timeVisible: true,
        },
        width: 300,
        height: 120,
      }

      // CPU Usage Chart
      const cpuChart = createChart(cpuChartRef.current, chartOptions)
      const cpuSeries = cpuChart.addAreaSeries({
        topColor: 'rgba(16, 185, 129, 0.4)',
        bottomColor: 'rgba(16, 185, 129, 0.0)',
        lineColor: '#10b981',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      })
      
      const cpuData: LineData[] = generateMockData(systemMetrics.resources.cpu.used_percent, 15)
      // Add current data point
      cpuData.push({
        time: Math.floor(Date.now() / 1000) as any,
        value: systemMetrics.resources.cpu.used_percent
      })
      cpuSeries.setData(cpuData)

      // Memory Usage Chart  
      const memoryChart = createChart(memoryChartRef.current, chartOptions)
      const memorySeries = memoryChart.addAreaSeries({
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      })
      
      const memoryData: LineData[] = generateMockData(systemMetrics.resources.memory.used_percent, 10)
      memoryData.push({
        time: Math.floor(Date.now() / 1000) as any,
        value: systemMetrics.resources.memory.used_percent
      })
      memorySeries.setData(memoryData)

      // Network I/O Chart (placeholder data)
      const networkChart = createChart(networkChartRef.current, {
        ...chartOptions,
        rightPriceScale: {
          ...chartOptions.rightPriceScale,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      })
      
      const networkInSeries = networkChart.addAreaSeries({
        topColor: 'rgba(245, 158, 11, 0.4)',
        bottomColor: 'rgba(245, 158, 11, 0.0)',
        lineColor: '#f59e0b',
        lineWidth: 2,
      })
      
      const networkOutSeries = networkChart.addAreaSeries({
        topColor: 'rgba(239, 68, 68, 0.4)',
        bottomColor: 'rgba(239, 68, 68, 0.0)',
        lineColor: '#ef4444',
        lineWidth: 2,
      })

      // Generate network data (placeholder - replace with real backend data)
      const networkInData: LineData[] = generateMockData(50, 25)
      const networkOutData: LineData[] = generateMockData(30, 20)
      networkInSeries.setData(networkInData)
      networkOutSeries.setData(networkOutData)

      setCharts({ cpuChart, memoryChart, networkChart })

      // Cleanup function
      return () => {
        cpuChart?.remove()
        memoryChart?.remove()
        networkChart?.remove()
      }
    } catch (error) {
      console.error('Error creating charts:', error)
    }
  }, [systemMetrics])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (charts.cpuChart) charts.cpuChart.applyOptions({ width: cpuChartRef.current?.clientWidth })
      if (charts.memoryChart) charts.memoryChart.applyOptions({ width: memoryChartRef.current?.clientWidth })
      if (charts.networkChart) charts.networkChart.applyOptions({ width: networkChartRef.current?.clientWidth })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [charts])

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
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">
          <span class="bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            Resource Performance
          </span>
        </h2>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Last 60 minutes • Live data
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
                <p class="text-lg font-bold text-[#10b981]">{systemMetrics.resources.cpu.used_percent.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div ref={cpuChartRef} class="h-30" />
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
          <div ref={memoryChartRef} class="h-30" />
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
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Network I/O</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">Placeholder Data</p>
              </div>
            </div>
          </div>
          <div ref={networkChartRef} class="h-30" />
        </div>
      </div>

      {/* Disk Usage & Other Metrics */}
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="card gradient-card shadow-lg shadow-[#f59e0b]/20">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">
              <span class="bg-gradient-to-r from-[#f59e0b] to-[#d97706] bg-clip-text text-transparent">
                Storage Usage
              </span>
            </h3>
          </div>
          <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-[#f59e0b]/20 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {formatBytes(systemMetrics.resources.disk.used)} / {formatBytes(systemMetrics.resources.disk.total)}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {systemMetrics.resources.disk.used_percent.toFixed(1)}% used
                </div>
              </div>
            </div>
            <div class="text-2xl font-bold text-[#f59e0b]">
              {systemMetrics.resources.disk.used_percent.toFixed(0)}%
            </div>
          </div>
        </div>

        <div class="card gradient-card shadow-lg shadow-[#8b008b]/20">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">
              <span class="bg-gradient-to-r from-[#8b008b] to-[#e94057] bg-clip-text text-transparent">
                Performance Metrics
              </span>
            </h3>
            <div class="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
              Backend Integration Needed
            </div>
          </div>
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">Load Average</span>
              <span class="text-sm font-mono font-medium text-gray-500">-- , -- , --</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">Active Processes</span>
              <span class="text-sm font-mono font-medium text-gray-500">---</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">File Descriptors</span>
              <span class="text-sm font-mono font-medium text-gray-500">--- / ---</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}