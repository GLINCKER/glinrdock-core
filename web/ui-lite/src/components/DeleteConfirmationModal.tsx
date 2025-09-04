import { useState } from 'preact/hooks'
import { X, AlertTriangle, Type } from 'lucide-preact'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  serviceName?: string
  requireTextConfirmation?: boolean
  confirmationText?: string
  isLoading?: boolean
  customContent?: any
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Service",
  message = "This action cannot be undone. This will permanently delete the service and all associated data.",
  serviceName,
  requireTextConfirmation = true,
  confirmationText,
  isLoading = false,
  customContent
}: DeleteConfirmationModalProps) {
  const [inputValue, setInputValue] = useState('')
  
  if (!isOpen) return null

  // Determine what text user needs to type to confirm
  const expectedText = confirmationText || serviceName || 'DELETE'
  const isConfirmationValid = !requireTextConfirmation || inputValue === expectedText
  
  const handleSubmit = (e: Event) => {
    e.preventDefault()
    if (isConfirmationValid && !isLoading) {
      onConfirm()
    }
  }

  const handleClose = () => {
    setInputValue('')
    onClose()
  }

  return (
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal content */}
        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit}>
            <div class="bg-white dark:bg-gray-800 px-6 pt-6 pb-4">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle class="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                  <h3 class="text-lg leading-6 font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h3>
                  <div class="mt-3 space-y-3">
                    {serviceName && (
                      <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">Service: {serviceName}</p>
                      </div>
                    )}
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {message}
                    </p>
                    {customContent}
                  </div>

                  {requireTextConfirmation && (
                    <div class="mt-4">
                      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
                        <div class="flex">
                          <Type class="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                          <div class="text-sm">
                            <p class="text-yellow-800 dark:text-yellow-200 font-medium">
                              Type <code class="bg-yellow-200 dark:bg-yellow-800 px-1.5 py-0.5 rounded font-mono text-xs">{expectedText}</code> to confirm
                            </p>
                          </div>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={inputValue}
                        onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
                        placeholder={`Type "${expectedText}" to confirm`}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {inputValue && inputValue !== expectedText && (
                        <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                          Please type "{expectedText}" exactly as shown
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={isLoading}
                >
                  <X class="h-5 w-5" />
                </button>
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={!isConfirmationValid || isLoading}
                class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-4 py-2.5 bg-red-600 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Forever'
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                class="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2.5 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}