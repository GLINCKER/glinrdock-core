import { Component, ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'

interface ErrorBoundaryProps {
  children: ComponentChildren
  fallback?: ComponentChildren
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo
    })
    
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private copyErrorDetails = async () => {
    const { error, errorInfo } = this.state
    
    const errorDetails = {
      timestamp: new Date().toISOString(),
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href
    }
    
    const errorText = JSON.stringify(errorDetails, null, 2)
    
    try {
      await navigator.clipboard.writeText(errorText)
      // Show temporary feedback
      const button = document.activeElement as HTMLButtonElement
      if (button) {
        const originalText = button.textContent
        button.textContent = 'Copied!'
        button.disabled = true
        setTimeout(() => {
          button.textContent = originalText
          button.disabled = false
        }, 2000)
      }
    } catch (err) {
      // Fallback: create text area and select
      const textArea = document.createElement('textarea')
      textArea.value = errorText
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
      } catch (copyErr) {
        console.warn('Failed to copy error details:', copyErr)
      }
      document.body.removeChild(textArea)
    }
  }

  private reload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div class="min-h-screen flex items-center justify-center bg-gray-900 p-4">
          <div class="max-w-md w-full">
            <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
              <div class="flex items-center space-x-3 mb-4">
                <div class="w-8 h-8 text-red-400 flex-shrink-0">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h2 class="text-red-400 font-semibold text-lg">Something went wrong</h2>
                  <p class="text-red-300 text-sm mt-1">
                    An unexpected error occurred in the application.
                  </p>
                </div>
              </div>
              
              {this.state.error && (
                <div class="bg-gray-800/50 border border-gray-700 rounded p-3 mb-4">
                  <p class="text-gray-300 text-sm font-mono break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              
              <div class="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={this.reload}
                  class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                >
                  Reload Page
                </button>
                <button
                  onClick={this.copyErrorDetails}
                  class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                >
                  Copy Error Details
                </button>
              </div>
              
              <p class="text-gray-400 text-xs mt-4 text-center">
                If the problem persists, please share the error details with support.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}