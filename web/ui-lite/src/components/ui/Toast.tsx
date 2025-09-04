import { useState } from 'preact/hooks'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  isVisible: boolean
  onClose: () => void
}

export function Toast({ message, type, isVisible, onClose }: ToastProps) {
  if (!isVisible) return null

  const typeStyles = {
    success: 'toast-success',
    error: 'toast-error', 
    info: 'toast-info'
  }

  // Auto-dismiss after 4 seconds
  useState(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  })

  return (
    <div class="fixed top-4 right-4 z-50 animate-slide-in">
      <div class={`toast ${typeStyles[type]} flex items-center justify-between min-w-80`}>
        <span class="text-sm">{message}</span>
        <button
          onClick={onClose}
          class="ml-4 text-current opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  )
}