import { Modal } from './ui/Modal'
import { PrimaryButton, SecondaryButton, DangerButton, ReloadButton } from './ui'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmStyle?: 'primary' | 'danger' | 'warning' | 'reload'
  disabled?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmStyle = 'primary',
  disabled = false
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm()
  }

  const getConfirmButton = () => {
    const buttonProps = {
      onClick: handleConfirm,
      disabled,
      size: 'lg' as const,
      children: confirmText
    }

    switch (confirmStyle) {
      case 'danger':
        return <DangerButton {...buttonProps} />
      case 'warning':
        return <PrimaryButton {...buttonProps} /> // We can add a warning variant later
      case 'reload':
        return <ReloadButton {...buttonProps} />
      default:
        return <PrimaryButton {...buttonProps} />
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div class="space-y-4">
        <p class="text-gray-600 dark:text-gray-300">{message}</p>
        
        <div class="flex items-center justify-end space-x-3 pt-4 border-t border-white/20 dark:border-gray-800">
          <SecondaryButton
            onClick={onClose}
            disabled={disabled}
            size="lg"
          >
            {cancelText}
          </SecondaryButton>
          {getConfirmButton()}
        </div>
      </div>
    </Modal>
  )
}