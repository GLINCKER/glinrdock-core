import { X } from 'lucide-preact'
import { JSX } from 'preact'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: JSX.Element | JSX.Element[]
}

export function InfoModal({ isOpen, onClose, title, children }: InfoModalProps) {
  if (!isOpen) return null

  return (
    <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" style="backdrop-filter: blur(4px); position: fixed; top: 0; left: 0; right: 0; bottom: 0;">
      {/* Backdrop */}
      <div 
        class="absolute inset-0 bg-black/20 dark:bg-black/80"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div class="relative max-w-lg w-full max-h-[80vh] overflow-auto z-10">
        <div class="bg-white dark:glassmorphism dark:bg-black/40 border border-gray-200 dark:border-white/20 rounded-2xl shadow-2xl">
          {/* Header */}
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={onClose}
              class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div class="p-6 text-gray-800 dark:text-gray-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}