import { useState, useEffect } from "preact/hooks";
import { FullScreenLogViewer } from "../../../components/FullScreenLogViewer";
import { Maximize2, AlertTriangle } from "lucide-preact";

interface LogsTabProps {
  serviceId: string;
  logs: string[];
  logsLoading: boolean;
  logsError: string | null;
  logsAutoRefresh: boolean;
  logsTailLines: number;
  isScrolledToBottom: boolean;
  crashLooping?: boolean;
  setLogsTailLines: (lines: number) => void;
  setLogsAutoRefresh: (autoRefresh: boolean) => void;
  setIsScrolledToBottom: (scrolled: boolean) => void;
  fetchLogs: () => Promise<void>;
}

export function LogsTab({
  serviceId,
  logs,
  logsLoading,
  logsError,
  logsAutoRefresh,
  logsTailLines,
  isScrolledToBottom,
  crashLooping,
  setLogsTailLines,
  setLogsAutoRefresh,
  setIsScrolledToBottom,
  fetchLogs,
}: LogsTabProps) {
  // Auto-set higher tail lines for crash-looping services
  useEffect(() => {
    if (crashLooping && logsTailLines < 200) {
      setLogsTailLines(200);
    }
  }, [crashLooping, logsTailLines, setLogsTailLines]);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  return (
    <>
      {logsLoading ? (
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-600 dark:text-gray-400">
              Loading logs...
            </p>
          </div>
        </div>
      ) : logsError ? (
        <div class="text-center py-12">
          <div class="text-red-500 text-xl mb-4 flex items-center justify-center">
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Logs Error
          </div>
          <p class="text-gray-600 dark:text-gray-400 mb-6">{logsError}</p>
          <button
            onClick={fetchLogs}
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex flex-col">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <svg
                  class="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Service Logs
              </h3>
              {crashLooping && (
                <div class="mt-1 flex items-center text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle class="w-4 h-4 mr-1" />
                  <span>Service in crash loop - showing 200+ lines for troubleshooting</span>
                </div>
              )}
            </div>

            <div class="flex items-center gap-3 flex-wrap">
              {/* Lines selector */}
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600 dark:text-gray-400">
                  Lines:
                </label>
                <select
                  value={logsTailLines}
                  onChange={(e) =>
                    setLogsTailLines(
                      parseInt((e.target as HTMLSelectElement).value)
                    )
                  }
                  class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
              </div>

              {/* Auto-refresh toggle */}
              <button
                onClick={() => setLogsAutoRefresh(!logsAutoRefresh)}
                class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center ${
                  logsAutoRefresh
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {logsAutoRefresh ? (
                  <svg
                    class="w-3 h-3 mr-1.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                ) : (
                  <svg
                    class="w-3 h-3 mr-1.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect width="8" height="8" x="8" y="8" />
                  </svg>
                )}
                {logsAutoRefresh ? "Auto" : "Manual"}
              </button>

              {/* Manual refresh */}
              <button
                onClick={fetchLogs}
                disabled={logsLoading}
                class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center"
              >
                <svg
                  class="w-4 h-4 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>

              {/* Full screen toggle */}
              <button
                onClick={() => setIsFullScreenOpen(true)}
                class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
              >
                <Maximize2 class="w-4 h-4 mr-1.5" />
                Full Screen
              </button>
            </div>
          </div>

          {logs.length > 0 ? (
            <div class="relative">
              <div class="bg-gray-900 dark:bg-gray-950 rounded-lg overflow-hidden border">
                <div
                  class="max-h-96 overflow-y-auto scrollbar-hide"
                  onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const isAtBottom =
                      target.scrollHeight - target.scrollTop ===
                      target.clientHeight;
                    setIsScrolledToBottom(isAtBottom);
                  }}
                >
                  <pre class="p-4 text-sm text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {logs.join("\n")}
                  </pre>
                </div>
              </div>

              {/* Scroll to bottom button */}
              {!isScrolledToBottom && (
                <button
                  onClick={() => {
                    const logContainer = document.querySelector(
                      ".max-h-96.overflow-y-auto"
                    ) as HTMLDivElement;
                    if (logContainer) {
                      logContainer.scrollTop = logContainer.scrollHeight;
                      setIsScrolledToBottom(true);
                    }
                  }}
                  class="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                  title="Scroll to bottom"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>
              )}

              {/* Logs info bar */}
              <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 px-2">
                <span>{logs.length} lines displayed</span>
                <span>
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          ) : (
            <div class="text-center py-12">
              <div class="text-gray-500 text-xl mb-4 flex items-center justify-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                No Logs
              </div>
              <p class="text-gray-600 dark:text-gray-400">
                No logs available for this service.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Full Screen Log Viewer */}
      <FullScreenLogViewer
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        serviceName={`Service ${serviceId}`}
        logs={logs}
        isLoading={logsLoading}
        onRefresh={fetchLogs}
        autoRefresh={logsAutoRefresh}
        onToggleAutoRefresh={() => setLogsAutoRefresh(!logsAutoRefresh)}
      />
    </>
  );
}