import { useEffect } from 'preact/hooks'
import { Link } from 'wouter'

interface NotFoundProps {
  title?: string
  message?: string
  showBackButton?: boolean
}

export function NotFound({ 
  title = "Page Not Found", 
  message = "The page you're looking for doesn't exist.",
  showBackButton = true
}: NotFoundProps) {
  
  useEffect(() => {
    document.title = `404 - ${title} | GLINR Dock`
    return () => {
      document.title = 'GLINR Dock'
    }
  }, [title])

  return (
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="text-center max-w-md mx-auto">
        {/* Large 404 Icon */}
        <div class="w-24 h-24 mx-auto mb-6 bg-gray-700/50 rounded-full flex items-center justify-center">
          <span class="text-4xl text-gray-500">404</span>
        </div>
        
        {/* Error Message */}
        <h1 class="text-2xl font-bold text-white mb-4">{title}</h1>
        <p class="text-gray-400 mb-8 leading-relaxed">{message}</p>
        
        {/* Action Buttons */}
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <button 
              onClick={() => window.history.back()}
              class="btn btn-ghost"
            >
              ← Go Back
            </button>
          )}
          <Link href="/" class="btn btn-primary">
            Go to Dashboard
          </Link>
        </div>
        
        {/* Helpful Links */}
        <div class="mt-8 pt-6 border-t border-gray-700">
          <p class="text-sm text-gray-500 mb-3">Quick navigation:</p>
          <div class="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/projects" class="text-blue-400 hover:text-blue-300">Projects</Link>
            <Link href="/services" class="text-blue-400 hover:text-blue-300">Services</Link>
            <Link href="/routes" class="text-blue-400 hover:text-blue-300">Routes</Link>
            <Link href="/logs" class="text-blue-400 hover:text-blue-300">Logs</Link>
          </div>
        </div>
      </div>
    </div>
  )
}