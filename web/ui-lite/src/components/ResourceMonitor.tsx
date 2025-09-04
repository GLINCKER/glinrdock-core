import { useState, useEffect } from 'preact/hooks';
import { ServiceStats } from '../api';

interface HistoricalStats {
  timestamp: number;
  stats: ServiceStats;
}

interface ResourceMonitorProps {
  serviceId: number;
  serviceStatus: string;
  containerId?: string;
}

export function ResourceMonitor({ serviceId, serviceStatus, containerId }: ResourceMonitorProps) {
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalStats[]>([]);

  // Local storage key for this specific container's history
  // Use container ID if available, otherwise fall back to service ID
  const storageKey = `glinrdock_stats_${containerId || `service_${serviceId}`}`;

  // Load historical data from localStorage on component mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Only load data from the last 15 minutes to avoid stale data
        const cutoffTime = Date.now() - (15 * 60 * 1000);
        const recentData = parsed.filter((item: HistoricalStats) => item.timestamp > cutoffTime);
        if (recentData.length > 0) {
          setHistoricalData(recentData);
        }
      }
    } catch (err) {
      console.warn('Failed to load historical data from localStorage:', err);
    }
  }, [serviceId, containerId]);
  
  useEffect(() => {
    // Only connect WebSocket when service is running
    if (serviceStatus !== 'running') {
      setStats(null);
      setIsConnected(false);
      setError(null);
      return;
    }
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    
    const connect = () => {
      try {
        setIsConnecting(true);
        setError(null);
        
        // For development, use the backend port directly
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const backendPort = '8080'; // Backend runs on 8080, frontend on 5173
        const wsUrl = `${protocol}//${host}:${backendPort}/v1/services/${serviceId}/stats`;
        console.log('Connecting to WebSocket:', wsUrl);
        
        // Get the authentication token from localStorage
        const token = localStorage.getItem('glinrdock_token');
        if (!token) {
          setError('Authentication required');
          setIsConnecting(false);
          return;
        }
        
        // Add authentication token to WebSocket URL as query parameter
        const tokenParam = `token=${encodeURIComponent(token)}`;
        const authenticatedUrl = wsUrl.includes('?') ? `${wsUrl}&${tokenParam}` : `${wsUrl}?${tokenParam}`;
        
        console.log('=== WebSocket Connection Debug ===');
        console.log('Service ID:', serviceId);
        console.log('Container ID:', containerId);
        console.log('Service Status:', serviceStatus);
        console.log('Storage Key:', storageKey);
        console.log('Token available:', !!token);
        console.log('WebSocket URL:', authenticatedUrl);
        console.log('======================================');
        
        ws = new WebSocket(authenticatedUrl);
        
        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
          if (ws && ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            setError('Connection timeout - WebSocket took too long to connect');
            setIsConnecting(false);
          }
        }, 10000); // 10 second timeout
        
        ws.onopen = () => {
          console.log('WebSocket connected successfully');
          clearTimeout(connectionTimeout);
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
        };
        
        ws.onmessage = (event) => {
          console.log('WebSocket message received:', event.data);
          try {
            const rawData = JSON.parse(event.data);
            console.log('Raw stats data from backend:', rawData);
            
            // Transform the data to match our expected interface
            // Handle different possible field names from Docker stats
            const transformedStats = {
              cpu_usage: parseCPUPerc(rawData.CPUPerc || rawData.cpu_usage || rawData.cpu_percent),
              memory_usage: parseMemoryUsage(rawData.MemUsage || rawData.memory_usage),
              memory_limit: parseMemoryLimit(rawData.MemUsage || rawData.memory_limit),
              network_rx: parseNetworkIO(rawData.NetIO, 'rx') || rawData.network_rx || 0,
              network_tx: parseNetworkIO(rawData.NetIO, 'tx') || rawData.network_tx || 0,
            };
            
            console.log('Transformed stats data:', transformedStats);
            
            // Store current stats and update timestamp
            const now = new Date();
            setStats(transformedStats);
            setLastUpdateTime(now);
            setError(null);
            
            // Keep historical data for trends (last 30 data points = ~15 minutes)
            setHistoricalData(prev => {
              const newData = [...prev, { timestamp: now.getTime(), stats: transformedStats }];
              const trimmedData = newData.slice(-30); // Keep last 30 points for extended trend visualization
              
              // Save to localStorage for persistence across page refreshes
              try {
                localStorage.setItem(storageKey, JSON.stringify(trimmedData));
              } catch (err) {
                console.warn('Failed to save historical data to localStorage:', err);
              }
              
              // Debug: Log timeline direction
              console.log(`📊 Historical data updated: ${trimmedData.length} points, newest: ${formatBytes(transformedStats.network_rx || 0)} RX`);
              
              return trimmedData;
            });
          } catch (err) {
            console.error('Failed to parse stats data:', err, 'Raw data:', event.data);
            setError('Failed to parse stats data');
          }
        };
        
        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          clearTimeout(connectionTimeout);
          setIsConnected(false);
          setIsConnecting(false);
          // Reconnect after 5 seconds if not manually closed
          if (ws && event.code !== 1000) { // Don't reconnect on normal closure
            setError(`Connection lost (${event.code}). Reconnecting in 5 seconds...`);
            reconnectTimeout = window.setTimeout(connect, 5000);
          }
        };
        
        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          clearTimeout(connectionTimeout);
          setError('Connection error - WebSocket failed to connect');
          setIsConnecting(false);
        };
      } catch (err) {
        setError('Failed to connect');
        console.error('WebSocket connection error:', err);
      }
    };
    
    connect();
    
    return () => {
      if (ws) {
        ws.close();
        ws = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [serviceId, serviceStatus]);
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper functions to parse Docker stats format
  const parseCPUPerc = (cpuPercStr: string | number | undefined): number | undefined => {
    if (typeof cpuPercStr === 'number') return cpuPercStr;
    if (!cpuPercStr) return undefined;
    
    // Parse "0.00%" format
    const match = String(cpuPercStr).match(/^(\d+\.?\d*)%?$/);
    return match ? parseFloat(match[1]) : undefined;
  };

  const parseMemoryUsage = (memUsageStr: string | number | undefined): number | undefined => {
    if (typeof memUsageStr === 'number') return memUsageStr;
    if (!memUsageStr) return undefined;
    
    // Parse "11.42MiB / 7.653GiB" format - extract first number and convert to bytes
    const usageMatch = String(memUsageStr).match(/^(\d+\.?\d*)(B|KiB|MiB|GiB)/);
    if (usageMatch) {
      const value = parseFloat(usageMatch[1]);
      const unit = usageMatch[2];
      const multipliers = { 'B': 1, 'KiB': 1024, 'MiB': 1024*1024, 'GiB': 1024*1024*1024 };
      return value * multipliers[unit as keyof typeof multipliers];
    }
    return undefined;
  };

  const parseMemoryLimit = (memUsageStr: string | number | undefined): number | undefined => {
    if (typeof memUsageStr === 'number') return memUsageStr;
    if (!memUsageStr) return undefined;
    
    // Parse "11.42MiB / 7.653GiB" format - extract second number and convert to bytes
    const limitMatch = String(memUsageStr).match(/\/\s*(\d+\.?\d*)(B|KiB|MiB|GiB)/);
    if (limitMatch) {
      const value = parseFloat(limitMatch[1]);
      const unit = limitMatch[2];
      const multipliers = { 'B': 1, 'KiB': 1024, 'MiB': 1024*1024, 'GiB': 1024*1024*1024 };
      return value * multipliers[unit as keyof typeof multipliers];
    }
    return undefined;
  };

  const parseNetworkIO = (netIOStr: string | undefined, direction: 'rx' | 'tx'): number | undefined => {
    if (!netIOStr) return undefined;
    
    // Parse "3.29kB / 2.49kB" format
    const parts = String(netIOStr).split(' / ');
    const targetPart = direction === 'rx' ? parts[0] : parts[1];
    if (!targetPart) return undefined;
    
    const match = targetPart.trim().match(/^(\d+\.?\d*)(B|kB|MB|GB)$/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      const multipliers = { 'B': 1, 'kB': 1000, 'MB': 1000*1000, 'GB': 1000*1000*1000 };
      return value * multipliers[unit as keyof typeof multipliers];
    }
    return undefined;
  };
  
  if (serviceStatus !== 'running') {
    return (
      <div class="bg-white/40 dark:bg-gray-800/40 rounded-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Resource Usage</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">Service Not Running</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Memory</div>
            <div class="text-sm font-mono text-gray-400 dark:text-gray-500">--- MB</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">CPU</div>
            <div class="text-sm font-mono text-gray-400 dark:text-gray-500">--%</div>
          </div>
        </div>
        <div class="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
          Start the service to view real-time resource usage
        </div>
      </div>
    );
  }
  
  return (
    <div class="bg-gradient-to-br from-white via-gray-50/90 to-white dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <span class="text-base font-semibold text-gray-800 dark:text-gray-200">Resource Usage</span>
        </div>
        <div class="flex items-center space-x-3">
          {/* Time context */}
          {lastUpdateTime && (
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Updated {new Date(lastUpdateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          
          {/* Connection status */}
          {isConnected ? (
            <div class="flex items-center bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <div class="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>
              <span class="text-xs font-medium text-green-600 dark:text-green-400">Live</span>
            </div>
          ) : error ? (
            <div class="flex items-center bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
              <div class="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div>
              <span class="text-xs font-medium text-red-600 dark:text-red-400">Error</span>
            </div>
          ) : isConnecting ? (
            <div class="flex items-center bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-full">
              <div class="w-2 h-2 bg-yellow-500 rounded-full mr-1.5 animate-spin"></div>
              <span class="text-xs font-medium text-yellow-600 dark:text-yellow-400">Connecting...</span>
            </div>
          ) : (
            <div class="flex items-center bg-gray-50 dark:bg-gray-900/20 px-2 py-1 rounded-full">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Disconnected</span>
            </div>
          )}
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-6">
        {/* Memory Usage with Arrow Chart */}
        <div class="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/30 dark:via-indigo-900/20 dark:to-blue-900/30 rounded-xl p-4 border border-blue-200/60 dark:border-blue-700/50 overflow-hidden">
          {/* Historical Trend Arrow Chart - Positioned in right empty space */}
          <div class="absolute top-2 right-3 bottom-2 w-56 flex items-center justify-between opacity-25 overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 224 80" class="overflow-visible">
              {/* Arrow path line */}
              <path 
                d={`M 0 40 ${Array.from({ length: 30 }, (_, i) => {
                  const dataIndex = Math.floor(i * historicalData.length / 30);
                  const dataPoint = historicalData[dataIndex];
                  const memoryPercent = dataPoint && dataPoint.stats.memory_limit 
                    ? (dataPoint.stats.memory_usage / dataPoint.stats.memory_limit) * 100 
                    : 10;
                  const x = (i / 29) * 220;
                  const y = 70 - (memoryPercent * 0.6); // Invert Y for SVG coordinate system
                  return `L ${x} ${Math.max(5, Math.min(75, y))}`;
                }).join(' ')}`}
                stroke="rgba(59, 130, 246, 0.6)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                class="transition-all duration-2000"
              />
              
              {/* Arrow points along the path */}
              {Array.from({ length: 6 }, (_, i) => {
                const dataIndex = Math.floor((i + 1) * historicalData.length / 6);
                const dataPoint = historicalData[dataIndex];
                const memoryPercent = dataPoint && dataPoint.stats.memory_limit 
                  ? (dataPoint.stats.memory_usage / dataPoint.stats.memory_limit) * 100 
                  : 10;
                const x = ((i + 1) / 6) * 220;
                const y = 70 - (memoryPercent * 0.6);
                const prevDataIndex = Math.floor(i * historicalData.length / 6);
                const prevDataPoint = historicalData[prevDataIndex];
                const prevMemoryPercent = prevDataPoint && prevDataPoint.stats.memory_limit 
                  ? (prevDataPoint.stats.memory_usage / prevDataPoint.stats.memory_limit) * 100 
                  : 10;
                const isIncreasing = memoryPercent > prevMemoryPercent;
                
                return (
                  <polygon
                    key={i}
                    points={`${x-4},${Math.max(5, Math.min(75, y))-4} ${x+4},${Math.max(5, Math.min(75, y))-4} ${x},${Math.max(5, Math.min(75, y))+4}`}
                    fill={isIncreasing 
                      ? memoryPercent > 80 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(234, 179, 8, 0.7)'
                      : 'rgba(34, 197, 94, 0.7)'
                    }
                    class="transition-all duration-2000"
                    transform={isIncreasing ? `rotate(180, ${x}, ${Math.max(5, Math.min(75, y))})` : ''}
                  />
                );
              })}
            </svg>
          </div>
          
          {/* Activity Pulse Background */}
          <div 
            class="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-indigo-400/20 to-blue-400/10 rounded-xl transition-opacity duration-2000"
            style={{
              opacity: stats && stats.memory_usage !== undefined && stats.memory_limit !== undefined && stats.memory_limit > 0
                ? Math.max(0.1, Math.min(0.4, (stats.memory_usage / stats.memory_limit)))
                : 0.1
            }}
          />
          
          <div class="relative z-10 flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center space-x-2 mb-2">
                <div class="text-xs font-medium text-blue-700 dark:text-blue-300">Memory Usage</div>
              </div>
              <div class="text-lg font-bold text-blue-800 dark:text-blue-200">
                {stats && stats.memory_usage !== undefined ? `${Math.round(stats.memory_usage / 1024 / 1024)} MB` : '--- MB'}
              </div>
              <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {stats && stats.memory_usage !== undefined && stats.memory_limit !== undefined && stats.memory_limit > 0
                  ? `${Math.round((stats.memory_usage / stats.memory_limit) * 100)}% of ${Math.round(stats.memory_limit / 1024 / 1024)} MB`
                  : 'Container Memory'
                }
              </div>
            </div>
          </div>
        </div>
        
        {/* CPU Usage with Arrow Chart */}
        <div class="relative bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 dark:from-emerald-900/30 dark:via-green-900/20 dark:to-emerald-900/30 rounded-xl p-4 border border-emerald-200/60 dark:border-emerald-700/50 overflow-hidden">
          {/* Historical Trend Arrow Chart - Positioned in right empty space */}
          <div class="absolute top-2 right-3 bottom-2 w-56 flex items-center justify-between opacity-25 overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 224 80" class="overflow-visible">
              {/* Arrow path line */}
              <path 
                d={`M 0 40 ${Array.from({ length: 30 }, (_, i) => {
                  const dataIndex = Math.floor(i * historicalData.length / 30);
                  const dataPoint = historicalData[dataIndex];
                  const cpuPercent = dataPoint ? dataPoint.stats.cpu_usage || 0 : 0.2;
                  const x = (i / 29) * 220;
                  // Scale CPU for better visibility (multiply by 30 since CPU is typically < 1%)
                  const y = 70 - (cpuPercent * 30); // Invert Y for SVG coordinate system
                  return `L ${x} ${Math.max(10, Math.min(70, y))}`;
                }).join(' ')}`}
                stroke="rgba(34, 197, 94, 0.6)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                class="transition-all duration-2000"
              />
              
              {/* Arrow points along the path */}
              {Array.from({ length: 6 }, (_, i) => {
                const dataIndex = Math.floor((i + 1) * historicalData.length / 6);
                const dataPoint = historicalData[dataIndex];
                const cpuPercent = dataPoint ? dataPoint.stats.cpu_usage || 0 : 0.2;
                const x = ((i + 1) / 6) * 220;
                const y = 70 - (cpuPercent * 30);
                const prevDataIndex = Math.floor(i * historicalData.length / 6);
                const prevDataPoint = historicalData[prevDataIndex];
                const prevCpuPercent = prevDataPoint ? prevDataPoint.stats.cpu_usage || 0 : 0.2;
                const isIncreasing = cpuPercent > prevCpuPercent;
                
                return (
                  <polygon
                    key={i}
                    points={`${x-4},${Math.max(10, Math.min(70, y))-4} ${x+4},${Math.max(10, Math.min(70, y))-4} ${x},${Math.max(10, Math.min(70, y))+4}`}
                    fill={isIncreasing 
                      ? cpuPercent > 1.0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(234, 179, 8, 0.7)'
                      : 'rgba(34, 197, 94, 0.7)'
                    }
                    class="transition-all duration-2000"
                    transform={isIncreasing ? `rotate(180, ${x}, ${Math.max(10, Math.min(70, y))})` : ''}
                  />
                );
              })}
            </svg>
          </div>
          
          {/* Activity Pulse Background */}
          <div 
            class="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-green-400/20 to-emerald-400/10 rounded-xl transition-opacity duration-2000"
            style={{
              opacity: stats && stats.cpu_usage !== undefined
                ? Math.max(0.1, Math.min(0.4, stats.cpu_usage / 2.0))
                : 0.1
            }}
          />
          
          <div class="relative z-10 flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center space-x-2 mb-2">
                <div class="text-xs font-medium text-emerald-700 dark:text-emerald-300">CPU Usage</div>
              </div>
              <div class="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {stats && stats.cpu_usage !== undefined ? `${stats.cpu_usage.toFixed(2)}%` : '--%'}
              </div>
              <div class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {stats && stats.cpu_usage !== undefined 
                  ? stats.cpu_usage > 1.0 ? 'High Load' : stats.cpu_usage > 0.30 ? 'Moderate Usage' : 'Low Usage'
                  : 'Host CPU Usage'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Network Stats with Historical Trend Graphics - Always show, progressively fill */}
      <div class="mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <div class="grid grid-cols-2 gap-4">
            {/* Network RX with Historical Trend Bars */}
            <div class="relative bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 dark:from-green-900/30 dark:via-emerald-900/20 dark:to-green-900/30 rounded-xl p-4 border border-green-200/60 dark:border-green-700/50 overflow-hidden">
              {/* Historical Trend Bars - Positioned in right empty space with better spacing */}
              <div class="absolute top-2 right-3 bottom-2 w-56 flex items-end justify-between opacity-30 overflow-hidden">
                {Array.from({ length: 40 }, (_, i) => {
                  // Right-to-left timeline: right = newest, left = oldest
                  // Map bar positions: bar 39 = newest data, bar 0 = oldest data
                  const dataIndex = Math.max(0, historicalData.length - (40 - i));
                  const dataPoint = dataIndex < historicalData.length ? historicalData[dataIndex] : null;
                  const hasData = dataPoint !== null && i >= (40 - historicalData.length);
                  
                  // Calculate max value from all historical data for proper scaling
                  const maxRx = historicalData.length > 0 ? Math.max(...historicalData.map(d => d.stats.network_rx || 0), 1024) : 1024;
                  const height = hasData && dataPoint
                    ? Math.max(25, Math.min(85, ((dataPoint.stats.network_rx || 0) / maxRx) * 65 + 25)) // Better minimum height
                    : hasData ? 25 : 8; // Minimum height for data, very small for empty slots
                  const intensity = hasData && dataPoint ? Math.min(1, (dataPoint.stats.network_rx || 0) / maxRx) : 0;
                  
                  // Better opacity handling for visual consistency
                  const opacity = hasData ? Math.max(0.3, 0.4 + intensity * 0.6) : 0.08; // Always visible when has data
                  const isLatest = i === 39 && hasData; // Rightmost bar is latest
                  
                  return (
                    <div 
                      key={i}
                      class="rounded-sm transition-all duration-1000 ease-out"
                      style={{
                        width: '3px',
                        height: `${height}%`,
                        backgroundColor: `rgba(34, 197, 94, ${opacity})`,
                        transform: isLatest ? 'scale(1.1)' : 'scale(1)', // Highlight latest (rightmost) bar
                        borderTop: isLatest ? '1px solid rgba(34, 197, 94, 0.9)' : 'none'
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Activity Pulse Background */}
              <div 
                class="absolute inset-0 bg-gradient-to-r from-green-400/10 via-emerald-400/20 to-green-400/10 rounded-xl transition-opacity duration-2000"
                style={{
                  opacity: Math.max(0.1, Math.min(0.4, (stats?.network_rx || 0) / (10 * 1024)))
                }}
              />
              
              <div class="relative z-10 flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center space-x-2 mb-2">
                    <div class="text-xs font-medium text-green-700 dark:text-green-300">Network RX</div>
                  </div>
                  <div class="text-lg font-bold text-green-800 dark:text-green-200">
                    {stats?.network_rx !== undefined ? formatBytes(stats.network_rx) : '--- B'}
                  </div>
                  <div class="text-xs text-green-600 dark:text-green-400 mt-1">
                    <span>Incoming Data</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Network TX with Historical Trend Bars */}
            <div class="relative bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 dark:from-blue-900/30 dark:via-cyan-900/20 dark:to-blue-900/30 rounded-xl p-4 border border-blue-200/60 dark:border-blue-700/50 overflow-hidden">
              {/* Historical Trend Bars - Positioned in right empty space with better spacing */}
              <div class="absolute top-2 right-3 bottom-2 w-56 flex items-end justify-between opacity-30 overflow-hidden">
                {Array.from({ length: 40 }, (_, i) => {
                  // Right-to-left timeline: right = newest, left = oldest
                  // Map bar positions: bar 39 = newest data, bar 0 = oldest data
                  const dataIndex = Math.max(0, historicalData.length - (40 - i));
                  const dataPoint = dataIndex < historicalData.length ? historicalData[dataIndex] : null;
                  const hasData = dataPoint !== null && i >= (40 - historicalData.length);
                  
                  // Calculate max value from all historical data for proper proportional scaling
                  const maxTx = historicalData.length > 0 ? Math.max(...historicalData.map(d => d.stats.network_tx || 0), 1024) : 1024;
                  const height = hasData && dataPoint
                    ? Math.max(25, Math.min(85, ((dataPoint.stats.network_tx || 0) / maxTx) * 65 + 25)) // Better minimum height
                    : hasData ? 25 : 8; // Minimum height for data, very small for empty slots
                  const intensity = hasData && dataPoint ? Math.min(1, (dataPoint.stats.network_tx || 0) / maxTx) : 0;
                  
                  // Better opacity handling for visual consistency
                  const opacity = hasData ? Math.max(0.3, 0.4 + intensity * 0.6) : 0.08; // Always visible when has data
                  const isLatest = i === 39 && hasData; // Rightmost bar is latest
                  
                  return (
                    <div 
                      key={i}
                      class="rounded-sm transition-all duration-1000 ease-out"
                      style={{
                        width: '3px',
                        height: `${height}%`,
                        backgroundColor: `rgba(59, 130, 246, ${opacity})`,
                        transform: isLatest ? 'scale(1.1)' : 'scale(1)', // Highlight latest (rightmost) bar
                        borderTop: isLatest ? '1px solid rgba(59, 130, 246, 0.9)' : 'none'
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Activity Pulse Background */}
              <div 
                class="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-cyan-400/20 to-blue-400/10 rounded-xl transition-opacity duration-2000"
                style={{
                  opacity: Math.max(0.1, Math.min(0.4, (stats?.network_tx || 0) / (8 * 1024)))
                }}
              />
              
              <div class="relative z-10 flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center space-x-2 mb-2">
                    <div class="text-xs font-medium text-blue-700 dark:text-blue-300">Network TX</div>
                  </div>
                  <div class="text-lg font-bold text-blue-800 dark:text-blue-200">
                    {stats?.network_tx !== undefined ? formatBytes(stats.network_tx) : '--- B'}
                  </div>
                  <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    <span>Outgoing Data</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      
      {error && (
        <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div class="text-sm text-red-700 dark:text-red-300 text-center">
            <span class="font-medium">{error}</span> - Retrying connection...
          </div>
        </div>
      )}
    </div>
  );
}