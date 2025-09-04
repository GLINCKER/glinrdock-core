import { useState, useEffect, useRef } from "preact/hooks";
import { 
  X, 
  Download, 
  Copy, 
  Search, 
  Filter, 
  Play, 
  Pause,
  RotateCcw,
  Clock,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2
} from "lucide-preact";

interface LogEntry {
  timestamp: string;
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  raw: string;
}

interface FullScreenLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  logs: string[];
  isLoading: boolean;
  onRefresh: () => void;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
}

export function FullScreenLogViewer({
  isOpen,
  onClose,
  serviceName,
  logs,
  isLoading,
  onRefresh,
  autoRefresh = false,
  onToggleAutoRefresh
}: FullScreenLogViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [logLevel, setLogLevel] = useState<string>("ALL");
  const [isMinimized, setIsMinimized] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Parse logs into structured format
  const parseLogEntry = (logLine: string): LogEntry => {
    // Try to extract timestamp and level from common log formats
    const timestampMatch = logLine.match(/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/);
    const levelMatch = logLine.match(/\b(INFO|WARN|ERROR|DEBUG)\b/i);
    
    return {
      timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
      level: levelMatch ? levelMatch[1].toUpperCase() as LogEntry['level'] : undefined,
      message: logLine,
      raw: logLine
    };
  };

  const parsedLogs = logs.map(parseLogEntry);

  // Filter logs based on search and level
  const filteredLogs = parsedLogs.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = logLevel === "ALL" || entry.level === logLevel;
    return matchesSearch && matchesLevel;
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Handle scroll detection for auto-scroll
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setAutoScroll(isAtBottom);
  };

  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-500';
      case 'WARN': return 'text-yellow-500';
      case 'INFO': return 'text-blue-500';
      case 'DEBUG': return 'text-gray-500';
      default: return 'text-gray-700 dark:text-gray-300';
    }
  };

  const copyLogs = () => {
    const logText = filteredLogs.map(entry => entry.raw).join('\n');
    navigator.clipboard.writeText(logText);
    // TODO: Show toast notification
  };

  const downloadLogs = () => {
    const logText = filteredLogs.map(entry => entry.raw).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToTop = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
      setAutoScroll(false);
    }
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div class={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl transition-all duration-300 ${
        isMinimized 
          ? 'w-96 h-16' 
          : 'w-full h-full max-w-7xl max-h-screen'
      }`}>
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center space-x-3">
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {serviceName} Logs
              </h2>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {filteredLogs.length} entries
            </div>
          </div>

          <div class="flex items-center space-x-2">
            {/* Auto-refresh toggle */}
            {onToggleAutoRefresh && (
              <button
                onClick={onToggleAutoRefresh}
                class={`p-2 rounded-lg transition-colors ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
                title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                {autoRefresh ? <Pause class="w-4 h-4" /> : <Play class="w-4 h-4" />}
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              class="p-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RotateCcw class={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Minimize/Maximize */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              class="p-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={isMinimized ? 'Maximize' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 class="w-4 h-4" /> : <Minimize2 class="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              class="p-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
              title="Close"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Controls */}
            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center space-x-4 flex-1">
                {/* Search */}
                <div class="relative">
                  <Search class="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                    placeholder="Search logs..."
                    class="pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Log Level Filter */}
                <div class="flex items-center space-x-2">
                  <Filter class="w-4 h-4 text-gray-400" />
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel((e.target as HTMLSelectElement).value)}
                    class="py-2 px-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Levels</option>
                    <option value="ERROR">Errors</option>
                    <option value="WARN">Warnings</option>
                    <option value="INFO">Info</option>
                    <option value="DEBUG">Debug</option>
                  </select>
                </div>

                {/* Timestamp toggle */}
                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showTimestamps}
                    onChange={(e) => setShowTimestamps((e.target as HTMLInputElement).checked)}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Clock class="w-4 h-4 text-gray-400" />
                  <span class="text-sm text-gray-600 dark:text-gray-400">Timestamps</span>
                </label>
              </div>

              <div class="flex items-center space-x-2">
                {/* Scroll controls */}
                <div class="flex items-center space-x-1">
                  <button
                    onClick={scrollToTop}
                    class="p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    title="Scroll to top"
                  >
                    <ChevronUp class="w-4 h-4" />
                  </button>
                  <button
                    onClick={scrollToBottom}
                    class="p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    title="Scroll to bottom"
                  >
                    <ChevronDown class="w-4 h-4" />
                  </button>
                </div>

                {/* Copy & Download */}
                <button
                  onClick={copyLogs}
                  class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
                >
                  <Copy class="w-4 h-4 mr-2" />
                  Copy
                </button>
                <button
                  onClick={downloadLogs}
                  class="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center"
                >
                  <Download class="w-4 h-4 mr-2" />
                  Download
                </button>
              </div>
            </div>

            {/* Log content */}
            <div 
              ref={logContainerRef}
              onScroll={handleScroll}
              class="flex-1 overflow-auto bg-gray-900 text-green-400 font-mono text-sm p-4 min-h-0"
              style={{ height: 'calc(100% - 120px)' }}
            >
              {filteredLogs.length === 0 ? (
                <div class="flex items-center justify-center h-full text-gray-500">
                  {searchTerm || logLevel !== "ALL" ? "No logs match your filters" : "No logs available"}
                </div>
              ) : (
                <div class="space-y-1">
                  {filteredLogs.map((entry, index) => (
                    <div key={index} class="flex hover:bg-gray-800/50 px-2 py-1 rounded">
                      {showTimestamps && (
                        <span class="text-gray-500 mr-4 shrink-0 w-48">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      )}
                      {entry.level && (
                        <span class={`mr-3 font-bold shrink-0 w-12 ${getLevelColor(entry.level)}`}>
                          {entry.level}
                        </span>
                      )}
                      <span class="break-all">
                        {entry.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Auto-scroll indicator */}
              {!autoScroll && (
                <div class="fixed bottom-20 right-8 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center text-sm">
                  <ChevronDown class="w-4 h-4 mr-1" />
                  New logs available
                  <button
                    onClick={scrollToBottom}
                    class="ml-2 underline hover:no-underline"
                  >
                    Scroll to bottom
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}