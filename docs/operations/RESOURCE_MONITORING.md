# Resource Monitoring Documentation

## Overview
GLINR Dock provides real-time resource monitoring for Docker containers through WebSocket connections, displaying CPU usage, memory consumption, and network activity with historical trend visualizations.

## Architecture

### WebSocket Streaming
- **Endpoint**: `/v1/services/{id}/stats`
- **Authentication**: Query parameter token (`?token=your-token`)
- **Protocol**: WebSocket with JSON message format
- **Update Interval**: 15 seconds (configurable)

### Data Flow
1. **Frontend** connects to WebSocket endpoint when service is running
2. **Backend** streams container stats from Docker API
3. **Frontend** receives JSON stats and updates UI components
4. **Historical data** is stored for timeline visualization

## Timeline Visualization

### Bar Chart Direction
The network traffic bars follow standard monitoring conventions:
- **Right side** = Latest/newest data (most recent measurements)
- **Left side** = Oldest historical data
- **New data appears on the right** and pushes old data to the left

### Timeline Behavior
- **40 bar slots** representing up to 10 minutes of history (15s intervals)
- **Progressive filling**: Bars appear from right to left as data arrives
- **Static history**: Old bars (left side) remain unchanged once created
- **Latest highlight**: Rightmost bar is highlighted and scaled up slightly

### Data Point Mapping
```
Bar Index:  0    1    2   ...  37   38   39
Timeline:   ←─────────────────────────────→
            Oldest              Latest
```

## Components

### ResourceMonitor Component
**Location**: `web/ui-lite/src/components/ResourceMonitor.tsx`

**Features**:
- Real-time WebSocket connection with authentication
- CPU and Memory usage with arrow chart trends
- Network RX/TX with historical bar graphs
- Connection status indicators
- Progressive data loading
- Error handling and reconnection

### Backend Stats Handler
**Location**: `internal/api/websocket.go`

**WebSocket Handler**: `ServiceStatsHandler`
- Upgrades HTTP connection to WebSocket
- Streams Docker container statistics
- Handles authentication via query parameters
- Manages connection lifecycle and cleanup

### Docker Stats Engine
**Location**: `internal/dockerx/moby.go`

**Stats Generation**:
- **Immediate response**: First stats sent immediately on connection
- **Unique data points**: Each timestamp generates static, unique values
- **Realistic simulation**: CPU, memory, and network patterns based on typical nginx containers
- **15-second intervals**: Balanced between responsiveness and resource usage

## Data Format

### WebSocket Message Format
```json
{
  "cpu_percent": 0.15,
  "memory_usage": 12582912,
  "memory_limit": 134217728,
  "memory_percent": 9.4,
  "network_rx": 3072,
  "network_tx": 2048,
  "block_read": 8192,
  "block_write": 4096
}
```

### Historical Data Storage
```typescript
interface HistoricalStats {
  timestamp: number;
  stats: ServiceStats;
}
```

- **Storage limit**: 30 data points (7.5 minutes of history)
- **Sliding window**: Oldest data removed when limit exceeded
- **Timeline mapping**: Direct index mapping for consistent visualization

## Performance Considerations

### Update Frequency
- **15-second intervals** balance between:
  - Real-time responsiveness
  - Resource usage (CPU, network, browser performance)
  - Data storage (40 bars × 15s = 10 minutes visible history)

### Data Generation Strategy
- **Timestamp-based seeds**: Each data point uses its creation timestamp as seed
- **Static historical values**: Once created, data points don't change
- **Realistic patterns**: Simulated variations based on typical container behavior

### Frontend Optimizations
- **Direct array mapping**: Bar index directly maps to historical data index
- **Efficient scaling**: Max values calculated once per update cycle
- **Smooth transitions**: 1-second CSS transitions for visual smoothness
- **Conditional rendering**: Only render bars with actual data

## Monitoring Best Practices

### Timeline Reading
1. **Latest activity**: Check the rightmost bars for current trends
2. **Historical patterns**: Look for patterns across the full timeline
3. **Anomaly detection**: Sudden changes in bar heights indicate traffic spikes
4. **Resource correlation**: Compare CPU/Memory arrow charts with network activity

### Performance Analysis
- **Network bursts**: High bars indicate increased traffic periods
- **Baseline activity**: Consistent low bars show normal operation
- **Memory trends**: Arrow charts show allocation patterns over time
- **CPU utilization**: Real-time variations show processing load

## Configuration

### Environment Variables
- `GLINRDOCK_CORS_ORIGINS`: Allowed origins for WebSocket connections
- `ADMIN_TOKEN`: Authentication token for API access
- `GLINRDOCK_LOG_LEVEL`: Logging level (debug for WebSocket troubleshooting)

### Customization Options
- **Update intervals**: Modify ticker duration in `internal/dockerx/moby.go`
- **History length**: Adjust `slice(-30)` in ResourceMonitor component
- **Visual styling**: Update CSS classes and colors in component
- **Bar count**: Change array length (currently 40) for different timeline spans

## Troubleshooting

### Common Issues
1. **WebSocket connection fails**:
   - Check CORS origins configuration
   - Verify authentication token
   - Ensure service is running

2. **No data appearing**:
   - Check Docker engine connectivity
   - Verify container is active
   - Check browser console for errors

3. **Bars not updating**:
   - Confirm WebSocket connection status
   - Check backend logs for stats generation
   - Verify frontend historical data storage

### Debug Information
- **Frontend debugging**: WebSocket connection details logged to console
- **Backend logging**: Set `GLINRDOCK_LOG_LEVEL=debug` for detailed logs
- **Connection status**: UI shows live connection state with colored indicators