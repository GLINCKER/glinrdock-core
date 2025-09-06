import { useState, useEffect } from 'preact/hooks';
import { useModal } from './ModalProvider';
import { apiClient as api } from '../api';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  RefreshCw,
  Database,
  Settings,
  Clock,
  Activity
} from 'lucide-preact';

interface SearchCapabilities {
  fts5: boolean;
  mode: string;
}

interface SearchSettingsModalProps {
  onSettingsChange?: () => void;
}

export function SearchSettingsModal({ onSettingsChange }: SearchSettingsModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [searchCapabilities, setSearchCapabilities] = useState<SearchCapabilities | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>('auto');
  const { hideModal } = useModal();

  const searchModes = [
    { 
      value: 'auto', 
      label: 'Auto', 
      icon: <Zap class="w-5 h-5" />,
      description: 'Automatically choose the best available search method based on system capabilities',
      recommended: true
    },
    { 
      value: 'basic', 
      label: 'Basic', 
      icon: <Search class="w-5 h-5" />,
      description: 'Simple text matching (fast, limited features)',
      performance: 'Fast'
    },
    { 
      value: 'advanced', 
      label: 'Advanced', 
      icon: <Database class="w-5 h-5" />,
      description: 'Full-text search with FTS5 (requires SQLite FTS5)',
      performance: 'Powerful'
    }
  ];

  useEffect(() => {
    loadSearchCapabilities();
  }, []);

  const loadSearchCapabilities = async () => {
    setIsLoading(true);
    try {
      const capabilities = await api.getSearchStatus();
      setSearchCapabilities(capabilities);
      setSelectedMode(capabilities.mode || 'auto');
    } catch (error) {
      console.error('Failed to load search capabilities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReindex = async (helpOnly: boolean = false) => {
    setIsReindexing(true);
    setReindexResult(null);

    try {
      const result = helpOnly 
        ? await api.reindexHelp()
        : await api.reindexSearch();
      
      setReindexResult({
        success: true,
        message: result.message || `${helpOnly ? 'Help' : 'Full'} reindex started successfully`
      });
      
      // Refresh capabilities after reindex
      setTimeout(() => {
        loadSearchCapabilities();
      }, 2000);
    } catch (error: any) {
      setReindexResult({
        success: false,
        message: error?.message || `Failed to start ${helpOnly ? 'help' : 'full'} reindex`
      });
    } finally {
      setIsReindexing(false);
    }
  };

  const handleSave = () => {
    // In a real implementation, you would save the search mode preference
    // For now, we just close the modal and call the callback
    if (onSettingsChange) {
      onSettingsChange();
    }
    hideModal();
  };

  if (isLoading) {
    return (
      <div class="space-y-6">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading search settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="text-center space-y-3">
        <div class="mx-auto w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Search class="w-8 h-8 text-purple-500" />
        </div>
        <div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Search Settings
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Configure search behavior and manage search index
          </p>
        </div>
      </div>

      {/* Current Status */}
      <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Current Status</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="flex items-center space-x-2">
            <span class="text-gray-600 dark:text-gray-400">FTS5 Available:</span>
            <div class="flex items-center space-x-1">
              {searchCapabilities?.fts5 ? (
                <>
                  <CheckCircle class="w-4 h-4 text-green-500" />
                  <span class="text-green-600 dark:text-green-400 font-medium">Yes</span>
                </>
              ) : (
                <>
                  <XCircle class="w-4 h-4 text-red-500" />
                  <span class="text-red-600 dark:text-red-400 font-medium">No</span>
                </>
              )}
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-gray-600 dark:text-gray-400">Current Mode:</span>
            <span class="text-gray-900 dark:text-white font-medium capitalize">
              {searchCapabilities?.mode || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Mode Selection */}
      <div class="space-y-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Search Mode</h4>
        <div class="space-y-3">
          {searchModes.map((mode) => (
            <label key={mode.value} class="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="searchMode"
                value={mode.value}
                checked={selectedMode === mode.value}
                onChange={(e) => setSelectedMode((e.target as HTMLInputElement).value)}
                class="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600"
              />
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-1">
                  {mode.icon}
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {mode.label}
                  </span>
                  {mode.recommended && (
                    <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
                      Recommended
                    </span>
                  )}
                  {mode.performance && (
                    <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded">
                      {mode.performance}
                    </span>
                  )}
                </div>
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  {mode.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Search Index Management */}
      <div class="space-y-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Index Management</h4>
        
        {/* Reindex Result */}
        {reindexResult && (
          <div class={`p-4 rounded-lg border ${
            reindexResult.success 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
          }`}>
            <div class="flex items-start space-x-3">
              {reindexResult.success ? (
                <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div class="text-sm">
                <p class={`font-medium ${
                  reindexResult.success 
                    ? 'text-green-800 dark:text-green-300' 
                    : 'text-red-800 dark:text-red-300'
                }`}>
                  {reindexResult.success ? 'Success' : 'Error'}
                </p>
                <p class={`${
                  reindexResult.success 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {reindexResult.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <div class="grid grid-cols-1 gap-3">
          <button
            onClick={() => handleReindex(false)}
            disabled={isReindexing}
            class="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isReindexing ? (
              <>
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Reindexing...</span>
              </>
            ) : (
              <>
                <RefreshCw class="w-4 h-4" />
                <span>Rebuild Full Search Index</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => handleReindex(true)}
            disabled={isReindexing}
            class="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isReindexing ? (
              <>
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Reindexing Help...</span>
              </>
            ) : (
              <>
                <Activity class="w-4 h-4" />
                <span>Rebuild Help Index Only</span>
              </>
            )}
          </button>
        </div>
        
        <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
          <div class="flex items-start space-x-2">
            <AlertTriangle class="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div class="text-xs text-yellow-700 dark:text-yellow-300">
              <p class="font-medium mb-1">About Search Index Rebuilding</p>
              <p>Full rebuild indexes all content (projects, services, routes, etc.). Help-only rebuild is faster and indexes only help documentation. Rebuilding runs in the background and may take a few seconds to complete.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div class="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={hideModal}
          class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          class="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <Settings class="w-4 h-4" />
          <span>Apply Settings</span>
        </button>
      </div>
    </div>
  );
}

export function useSearchSettingsModal() {
  const { showModal } = useModal();

  const showSearchSettingsModal = (onSettingsChange?: () => void) => {
    showModal(
      'Search Configuration',
      <SearchSettingsModal onSettingsChange={onSettingsChange} />
    );
  };

  return { showSearchSettingsModal };
}