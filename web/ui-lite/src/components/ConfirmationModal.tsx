import { useModal } from './ModalProvider';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-preact';

interface ConfirmationModalProps {
  title: string;
  message: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmationModal({ 
  title,
  message, 
  type = 'warning',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  const { hideModal } = useModal();

  const config = {
    warning: {
      icon: <AlertTriangle class="w-6 h-6 text-yellow-500" />,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-200 dark:border-yellow-800/30',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      confirmButtonColor: 'bg-yellow-500 hover:bg-yellow-600',
      iconBgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    danger: {
      icon: <XCircle class="w-6 h-6 text-red-500" />,
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-200 dark:border-red-800/30',
      textColor: 'text-red-800 dark:text-red-300',
      confirmButtonColor: 'bg-red-500 hover:bg-red-600',
      iconBgColor: 'bg-red-100 dark:bg-red-900/30'
    },
    info: {
      icon: <Info class="w-6 h-6 text-blue-500" />,
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 dark:border-blue-800/30',
      textColor: 'text-blue-800 dark:text-blue-300',
      confirmButtonColor: 'bg-blue-500 hover:bg-blue-600',
      iconBgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    success: {
      icon: <CheckCircle class="w-6 h-6 text-green-500" />,
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-200 dark:border-green-800/30',
      textColor: 'text-green-800 dark:text-green-300',
      confirmButtonColor: 'bg-green-500 hover:bg-green-600',
      iconBgColor: 'bg-green-100 dark:bg-green-900/30'
    }
  };

  const currentConfig = config[type];

  const handleConfirm = () => {
    onConfirm();
    hideModal();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    hideModal();
  };

  return (
    <div class="space-y-6">
      {/* Header with icon */}
      <div class="text-center space-y-3">
        <div class={`mx-auto w-16 h-16 rounded-full ${currentConfig.iconBgColor} flex items-center justify-center`}>
          {currentConfig.icon}
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
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

      {/* Action buttons */}
      <div class="flex space-x-3">
        <button
          onClick={handleCancel}
          class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          class={`flex-1 px-4 py-3 ${currentConfig.confirmButtonColor} text-white text-sm font-medium rounded-lg transition-colors`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}

export function useConfirmationModal() {
  const { showModal } = useModal();

  const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      type?: 'warning' | 'danger' | 'info' | 'success';
      confirmText?: string;
      cancelText?: string;
      onCancel?: () => void;
    }
  ) => {
    showModal(
      title,
      <ConfirmationModal 
        title={title}
        message={message}
        type={options?.type || 'warning'}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        onConfirm={onConfirm}
        onCancel={options?.onCancel}
      />
    );
  };

  return { showConfirmation };
}