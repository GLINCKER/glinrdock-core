import { useModal } from './ModalProvider';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-preact';

interface NotificationModalProps {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export function NotificationModal({ message, type }: NotificationModalProps) {
  const { hideModal } = useModal();

  const config = {
    info: {
      icon: <Info class="w-6 h-6 text-blue-500" />,
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 dark:border-blue-800/30',
      textColor: 'text-blue-800 dark:text-blue-300',
      buttonColor: 'bg-blue-500 hover:bg-blue-600'
    },
    success: {
      icon: <CheckCircle class="w-6 h-6 text-green-500" />,
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-200 dark:border-green-800/30', 
      textColor: 'text-green-800 dark:text-green-300',
      buttonColor: 'bg-green-500 hover:bg-green-600'
    },
    error: {
      icon: <XCircle class="w-6 h-6 text-red-500" />,
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-200 dark:border-red-800/30',
      textColor: 'text-red-800 dark:text-red-300',
      buttonColor: 'bg-red-500 hover:bg-red-600'
    },
    warning: {
      icon: <AlertTriangle class="w-6 h-6 text-yellow-500" />,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-200 dark:border-yellow-800/30',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      buttonColor: 'bg-yellow-500 hover:bg-yellow-600'
    }
  };

  const currentConfig = config[type];

  return (
    <div class="space-y-6">
      {/* Header with icon */}
      <div class="text-center space-y-3">
        <div class="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {currentConfig.icon}
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white capitalize">
            {type}
          </h3>
        </div>
      </div>

      {/* Message */}
      <div class={`p-4 rounded-lg border ${currentConfig.bgColor} ${currentConfig.borderColor}`}>
        <div class="flex items-start space-x-3">
          {currentConfig.icon}
          <div class="text-sm">
            <p class={`${currentConfig.textColor} font-medium`}>
              {message}
            </p>
          </div>
        </div>
      </div>

      {/* Action button */}
      <div class="flex justify-center">
        <button
          onClick={hideModal}
          class={`px-6 py-3 ${currentConfig.buttonColor} text-white text-sm font-medium rounded-lg transition-colors`}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function useNotificationModal() {
  const { showModal } = useModal();

  const showNotification = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const titles = {
      info: 'Information',
      success: 'Success',
      error: 'Error',
      warning: 'Warning'
    };

    showModal(
      titles[type],
      <NotificationModal message={message} type={type} />
    );
  };

  return { showNotification };
}