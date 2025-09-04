interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: any
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-2xl'
  }

  return (
    <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        class="absolute inset-0 bg-black/15 dark:bg-black/20 backdrop-blur-lg"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div class={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-black backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 animate-fade-in ring-1 ring-white/10 dark:ring-gray-700/20`}>
        {/* Header */}
        <div class="relative flex items-center justify-between p-6 bg-gradient-to-r from-white/60 to-white/40 dark:from-black dark:to-gray-900/90 backdrop-blur-xl border-b border-white/20 dark:border-gray-800">
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div class="p-6 bg-gradient-to-b from-white/30 to-white/10 dark:from-gray-800/30 dark:to-gray-800/10 backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  )
}