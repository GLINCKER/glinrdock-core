import { createContext, ComponentChildren } from 'preact'
import { useContext, useState } from 'preact/hooks'
import { JSX } from 'preact'

interface ModalConfig {
  title: string
  children: JSX.Element | JSX.Element[]
  isOpen: boolean
}

interface ModalContextType {
  showModal: (title: string, children: JSX.Element | JSX.Element[]) => void
  hideModal: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return context
}

interface ModalProviderProps {
  children: ComponentChildren
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modal, setModal] = useState<ModalConfig>({ title: '', children: null, isOpen: false })

  const showModal = (title: string, children: JSX.Element | JSX.Element[]) => {
    setModal({ title, children, isOpen: true })
  }

  const hideModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }))
  }

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      
      {/* Global Modal Overlay */}
      {modal.isOpen && (
        <div 
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style="backdrop-filter: blur(4px);"
        >
          {/* Backdrop */}
          <div 
            class="absolute inset-0 bg-black/20 dark:bg-black/80"
            onClick={hideModal}
          />
          
          {/* Modal */}
          <div class="relative max-w-lg w-full max-h-[80vh] overflow-auto z-10">
            <div class="bg-white dark:glassmorphism dark:bg-black/40 border border-gray-200 dark:border-white/20 rounded-2xl shadow-2xl">
              {/* Header */}
              <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {modal.title}
                </h3>
                <button
                  onClick={hideModal}
                  class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div class="p-6 text-gray-800 dark:text-gray-300">
                {modal.children}
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}