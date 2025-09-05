import { useState, useEffect } from 'preact/hooks';
import { useModal } from './ModalProvider';
import { apiClient as api } from '../api';
import { 
  Play, 
  Square, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Cpu,
  Terminal,
  Clock,
  Activity,
  RefreshCw
} from 'lucide-preact';

interface ServiceManagementModalProps {
  action: 'start' | 'stop' | 'restart';
  serviceStatus: 'running' | 'stopped' | 'unknown';
  onActionComplete?: () => void;
}

export function ServiceManagementModal({ action, serviceStatus, onActionComplete }: ServiceManagementModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { hideModal } = useModal();

  const actionConfig = {
    start: {
      title: 'Start Backend Service',
      icon: <Play class="w-6 h-6 text-green-500" />,
      color: 'green',
      steps: ['Initializing service...', 'Starting backend server...', 'Service ready!'],
      description: 'This will initiate the backend service startup sequence.',
    },
    stop: {
      title: 'Stop Backend Service',
      icon: <Square class="w-6 h-6 text-red-500 fill-current" />,
      color: 'red',
      steps: ['Graceful shutdown initiated...', 'Closing connections...', 'Service stopped'],
      description: 'This will initiate the backend service shutdown sequence. The frontend may lose connectivity.',
      warning: true,
    },
    restart: {
      title: 'Restart Backend Service',
      icon: <RotateCcw class="w-6 h-6 text-orange-500" />,
      color: 'orange',
      steps: ['Recording restart request...', 'Clearing lockdown state...', 'Notifying system...', 'Restart initiated!'],
      description: 'This will initiate an emergency restart of the backend service.',
    }
  };

  const config = actionConfig[action];
  const isDevelopmentMode = window.location.hostname === 'localhost';

  const executeAction = async () => {
    setIsExecuting(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress steps
      for (let i = 0; i < config.steps.length; i++) {
        setCurrentStep(config.steps[i]);
        setProgress(((i + 1) / config.steps.length) * 100);
        
        if (i === config.steps.length - 1) {
          // Final step - actually execute the action
          try {
            if (action === 'start') {
              await api.systemStart();
              setResult({
                success: true,
                message: 'System start completed successfully.'
              });
            } else if (action === 'stop') {
              await api.systemStop();
              setResult({
                success: true,
                message: 'System stop initiated successfully.'
              });
            } else if (action === 'restart') {
              await api.emergencyRestart();
              setResult({
                success: true,
                message: 'Emergency restart initiated successfully. Note: This is a simulated restart in demo mode.'
              });
            }
          } catch (error: any) {
            setResult({
              success: false,
              message: `Failed to ${action} system: ${error?.message || 'Unknown error occurred'}`
            });
          }
        } else {
          // Intermediate steps
          await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
        }
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error?.message || `Failed to ${action} service. Please try again.`
      });
    } finally {
      setIsExecuting(false);
      if (onActionComplete) {
        onActionComplete();
      }
    }
  };

  const handleClose = () => {
    if (!isExecuting) {
      hideModal();
    }
  };

  return (
    <div class="space-y-6">
      {/* Header with icon and description */}
      <div class="text-center space-y-3">
        <div class="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {config.icon}
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {config.title}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {config.description}
          </p>
        </div>
      </div>

      {/* Warning for stop action */}
      {config.warning && !isExecuting && !result && (
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
          <div class="flex items-start space-x-3">
            <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div class="text-sm">
              <p class="font-medium text-red-800 dark:text-red-300 mb-1">Warning</p>
              <p class="text-red-700 dark:text-red-400">
                Stopping the service will disconnect all users and make the system unavailable. 
                Only proceed if you're sure you want to stop the service.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current service status */}
      <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status</span>
          <div class="flex items-center">
            <div class={`w-2 h-2 rounded-full mr-2 ${
              serviceStatus === 'running' ? 'bg-green-500' : 
              serviceStatus === 'stopped' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span class="text-xs font-medium text-gray-900 dark:text-white capitalize">
              {serviceStatus === 'unknown' ? 'Checking...' : serviceStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Progress section */}
      {isExecuting && (
        <div class="space-y-4">
          {/* Progress bar */}
          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-gray-600 dark:text-gray-400">Progress</span>
              <span class="text-gray-900 dark:text-white font-medium">{Math.round(progress)}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                class={`h-2 rounded-full bg-${config.color}-500 transition-all duration-300 ease-out`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Current step */}
          <div class="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span class="text-sm font-medium text-blue-800 dark:text-blue-300">
              {currentStep}
            </span>
          </div>
        </div>
      )}

      {/* Result section */}
      {result && (
        <div class={`p-4 rounded-lg border ${
          result.success 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
        }`}>
          <div class="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <div class="text-sm">
              <p class={`font-medium mb-1 ${
                result.success 
                  ? 'text-green-800 dark:text-green-300' 
                  : 'text-red-800 dark:text-red-300'
              }`}>
                {result.success ? 'Success' : 'Error'}
              </p>
              <p class={`${
                result.success 
                  ? 'text-green-700 dark:text-green-400' 
                  : 'text-red-700 dark:text-red-400'
              }`}>
                {result.message}
              </p>
              {isDevelopmentMode && action === 'start' && !result.success && (
                <div class="mt-3 p-3 bg-gray-900 dark:bg-gray-800 rounded-lg">
                  <div class="flex items-center space-x-2 mb-2">
                    <Terminal class="w-4 h-4 text-gray-400" />
                    <span class="text-xs font-medium text-gray-400">Terminal Command</span>
                  </div>
                  <code class="text-sm font-mono text-green-400">./dev-start.sh</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div class="flex space-x-3">
        {!result ? (
          <>
            <button
              onClick={handleClose}
              disabled={isExecuting}
              class="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeAction}
              disabled={isExecuting}
              class={`flex-1 px-4 py-3 bg-${config.color}-500 hover:bg-${config.color}-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center space-x-2`}
            >
              {isExecuting ? (
                <>
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {config.icon}
                  <span>{config.title}</span>
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={handleClose}
            class="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export function useServiceManagementModal() {
  const { showModal } = useModal();

  const showServiceModal = (
    action: 'start' | 'stop' | 'restart',
    serviceStatus: 'running' | 'stopped' | 'unknown',
    onActionComplete?: () => void
  ) => {
    const actionTitles = {
      start: 'Start Backend Service',
      stop: 'Stop Backend Service',
      restart: 'Restart Backend Service'
    };

    showModal(
      actionTitles[action],
      <ServiceManagementModal 
        action={action} 
        serviceStatus={serviceStatus}
        onActionComplete={onActionComplete}
      />
    );
  };

  return { showServiceModal };
}