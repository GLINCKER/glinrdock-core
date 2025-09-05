import { useState, useEffect, useContext } from 'preact/hooks';
import { createContext, ComponentChildren } from 'preact';
import { Link } from 'wouter';
import { AlertTriangle, Wifi, WifiOff, Settings as SettingsIcon, RefreshCw } from 'lucide-preact';

interface ConnectionState {
  isOnline: boolean;
  isChecking: boolean;
  lastCheck: Date | null;
  checkConnection: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionState>({
  isOnline: true,
  isChecking: false,
  lastCheck: null,
  checkConnection: async () => {}
});

export const useConnection = () => useContext(ConnectionContext);

interface ConnectionProviderProps {
  children: ComponentChildren;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkConnection = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/v1/health', {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setIsOnline(response.ok);
      setLastCheck(new Date());
    } catch (error) {
      setIsOnline(false);
      setLastCheck(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkConnection();

    // Set up periodic health checks
    const interval = setInterval(checkConnection, 30000); // Every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('Browser detected online');
      checkConnection();
    };
    
    const handleOffline = () => {
      console.log('Browser detected offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ConnectionContext.Provider value={{ isOnline, isChecking, lastCheck, checkConnection }}>
      {children}
    </ConnectionContext.Provider>
  );
}

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  const { isOnline, isChecking, checkConnection } = useConnection();

  if (isOnline) return null;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 border-b-2 border-red-700 shadow-lg animate-in slide-in-from-top duration-500 ${className}`}>
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12 animate-pulse"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 p-2 bg-red-600/50 rounded-full">
              <WifiOff className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-base font-bold text-white">
                  🔴 Backend Service Offline
                </h3>
                <div className="px-2 py-0.5 bg-red-700 rounded-full">
                  <span className="text-xs font-mono text-red-100">CONNECTION LOST</span>
                </div>
              </div>
              <p className="text-sm text-red-100">
                Unable to reach the backend server. Click "Service Management" to diagnose and restart services.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => checkConnection()}
              disabled={isChecking}
              className="group inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 border border-white/30 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
            >
              {isChecking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                  Retry Connection
                </>
              )}
            </button>
            
            <Link 
              href="/app/settings/system-admin" 
              className="group inline-flex items-center px-4 py-2 bg-white text-red-600 hover:bg-red-50 border-2 border-white rounded-lg text-sm font-bold transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <div className="p-1 bg-red-100 rounded mr-2 group-hover:bg-red-200 transition-colors">
                <SettingsIcon className="h-3 w-3 text-red-600" />
              </div>
              Service Management
            </Link>
          </div>
        </div>
      </div>
      
      {/* Animated bottom border */}
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-red-300 via-white to-red-300 animate-pulse"></div>
    </div>
  );
}

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({ className = '', showLabel = false }: ConnectionStatusProps) {
  const { isOnline, isChecking } = useConnection();

  return (
    <div className={`flex items-center ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        isChecking ? 'bg-yellow-500 animate-pulse' :
        isOnline ? 'bg-green-500' : 'bg-red-500'
      }`} />
      {showLabel && (
        <span className={`ml-2 text-xs font-medium ${
          isChecking ? 'text-yellow-600 dark:text-yellow-400' :
          isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {isChecking ? 'Checking...' : isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}