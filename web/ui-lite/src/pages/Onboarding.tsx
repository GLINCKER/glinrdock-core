import { useState, useEffect } from 'preact/hooks'
import { useLocation } from 'wouter'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

interface OnboardingStatus {
  needed: boolean
}

interface StepProps {
  isActive: boolean
  onNext: () => void
  onPrev?: () => void
}

interface TokenRotationStepProps extends StepProps {
  currentToken: string
  onTokenRotated: (newToken: string) => void
}

interface ProjectCreationStepProps extends StepProps {
  onProjectCreated: (projectId: number) => void
}

interface ServiceCreationStepProps extends StepProps {
  projectId?: number
  onServiceCreated: (serviceId: number) => void
}

interface ProjectCreateRequest {
  name: string
}

interface ServiceCreateRequest {
  name: string
  image: string
  env?: Record<string, string>
  ports?: Array<{ container: number; host: number }>
}

interface TokenCreateRequest {
  name: string
  plain: string
  role: string
}

function TokenRotationStep({ isActive, onNext, currentToken, onTokenRotated }: TokenRotationStepProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRotateToken = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Generate new token
      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      
      // Create new admin token
      const response = await fetch('/v1/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          name: 'admin-rotated',
          plain: newToken,
          role: 'admin'
        } as TokenCreateRequest)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create new token')
      }

      // Update localStorage with new token
      localStorage.setItem('glinrdock_token', newToken)
      onTokenRotated(newToken)
      setSuccess('Admin token rotated successfully!')
      
      setTimeout(() => onNext(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate token')
    } finally {
      setLoading(false)
    }
  }

  if (!isActive) return null

  return (
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-2xl font-bold text-white mb-2">Secure Your Admin Access</h2>
        <p class="text-gray-400">
          For security, we recommend rotating your admin token to a new, secure value.
        </p>
      </div>

      <div class="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <div class="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <span class="text-yellow-400 text-xs">!</span>
            </div>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-400">Security Notice</h3>
            <p class="text-sm text-yellow-300 mt-1">
              Your current admin token will be replaced with a new, randomly generated secure token.
              Make sure to save the new token after rotation.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
          <p class="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div class="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
          <p class="text-green-400 text-sm">{success}</p>
        </div>
      )}

      <div class="flex justify-between">
        <button
          type="button"
          onClick={onNext}
          class="text-gray-400 hover:text-white text-sm underline"
        >
          Skip for now
        </button>
        <button
          onClick={handleRotateToken}
          disabled={loading}
          class="btn btn-primary flex items-center space-x-2"
        >
          {loading && <LoadingSpinner size="sm" />}
          <span>{loading ? 'Rotating...' : 'Rotate Admin Token'}</span>
        </button>
      </div>
    </div>
  )
}

function ProjectCreationStep({ isActive, onNext, onPrev, onProjectCreated }: ProjectCreationStepProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('glinrdock_token')
      const response = await fetch('/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim()
        } as ProjectCreateRequest)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const data = await response.json()
      onProjectCreated(data.id)
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  if (!isActive) return null

  return (
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-2xl font-bold text-white mb-2">Create Your First Project</h2>
        <p class="text-gray-400">
          Projects help you organize your services and deployments.
        </p>
      </div>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label htmlFor="project-name" class="block text-sm font-medium text-gray-300 mb-2">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="e.g., my-awesome-app"
            class="input"
            disabled={loading}
            required
          />
        </div>

        {error && (
          <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div class="flex justify-between">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              class="btn btn-secondary"
            >
              Previous
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            class="btn btn-primary flex items-center space-x-2 ml-auto"
          >
            {loading && <LoadingSpinner size="sm" />}
            <span>{loading ? 'Creating...' : 'Create Project'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

function ServiceCreationStep({ isActive, onNext, onPrev, projectId, onServiceCreated }: ServiceCreationStepProps) {
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [port, setPort] = useState('3000')
  const [env, setEnv] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()

    if (!name.trim() || !image.trim()) {
      setError('Service name and image are required')
      return
    }

    if (!projectId) {
      setError('No project selected')
      return
    }

    setLoading(true)
    setError('')

    try {
      let parsedEnv = {}
      if (env.trim()) {
        try {
          parsedEnv = JSON.parse(env)
        } catch {
          throw new Error('Invalid JSON format for environment variables')
        }
      }

      const ports = port.trim() ? [{ container: parseInt(port), host: parseInt(port) }] : []

      const token = localStorage.getItem('glinrdock_token')
      const response = await fetch(`/v1/projects/${projectId}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          image: image.trim(),
          env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined,
          ports: ports.length > 0 ? ports : undefined
        } as ServiceCreateRequest)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create service')
      }

      const data = await response.json()
      onServiceCreated(data.id)
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service')
    } finally {
      setLoading(false)
    }
  }

  if (!isActive) return null

  return (
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-2xl font-bold text-white mb-2">Create Your First Service</h2>
        <p class="text-gray-400">
          Services are containerized applications that run within your project.
        </p>
      </div>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label htmlFor="service-name" class="block text-sm font-medium text-gray-300 mb-2">
            Service Name
          </label>
          <input
            id="service-name"
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="e.g., web-app"
            class="input"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label htmlFor="service-image" class="block text-sm font-medium text-gray-300 mb-2">
            Docker Image
          </label>
          <input
            id="service-image"
            type="text"
            value={image}
            onInput={(e) => setImage((e.target as HTMLInputElement).value)}
            placeholder="e.g., nginx:latest"
            class="input"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label htmlFor="service-port" class="block text-sm font-medium text-gray-300 mb-2">
            Port (optional)
          </label>
          <input
            id="service-port"
            type="number"
            value={port}
            onInput={(e) => setPort((e.target as HTMLInputElement).value)}
            placeholder="3000"
            class="input"
            disabled={loading}
            min="1"
            max="65535"
          />
        </div>

        <div>
          <label htmlFor="service-env" class="block text-sm font-medium text-gray-300 mb-2">
            Environment Variables (JSON, optional)
          </label>
          <textarea
            id="service-env"
            value={env}
            onInput={(e) => setEnv((e.target as HTMLTextAreaElement).value)}
            placeholder='{"NODE_ENV": "production", "PORT": "3000"}'
            class="input min-h-[80px] resize-vertical"
            disabled={loading}
          />
        </div>

        {error && (
          <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div class="flex justify-between">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              class="btn btn-secondary"
            >
              Previous
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !name.trim() || !image.trim()}
            class="btn btn-primary flex items-center space-x-2 ml-auto"
          >
            {loading && <LoadingSpinner size="sm" />}
            <span>{loading ? 'Creating...' : 'Create Service'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

function CompletionStep({ isActive }: { isActive: boolean }) {
  const [, setLocation] = useLocation()
  const [completing, setCompleting] = useState(false)

  const handleComplete = async () => {
    setCompleting(true)

    try {
      const token = localStorage.getItem('glinrdock_token')
      const response = await fetch('/v1/system/onboarding/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        console.error('Failed to complete onboarding:', await response.text())
      }
    } catch (err) {
      console.error('Error completing onboarding:', err)
    } finally {
      // Redirect to dashboard regardless of completion API success
      setLocation('/dashboard')
    }
  }

  useEffect(() => {
    if (isActive) {
      // Auto-complete after a short delay to show success message
      setTimeout(handleComplete, 2000)
    }
  }, [isActive])

  if (!isActive) return null

  return (
    <div class="space-y-6 text-center">
      <div class="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
        <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
          <span class="text-white text-lg">✓</span>
        </div>
      </div>

      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
        <p class="text-gray-400">
          Welcome to GLINR Dock! Your platform is ready for use.
        </p>
      </div>

      <div class="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
        <h3 class="text-green-400 font-medium mb-2">What's Next?</h3>
        <ul class="text-green-300 text-sm space-y-1 text-left">
          <li>• Explore your project and service in the dashboard</li>
          <li>• Set up routes to expose your services</li>
          <li>• Configure CI/CD pipelines for automated deployments</li>
          <li>• Invite team members and manage access controls</li>
        </ul>
      </div>

      {completing && (
        <div class="flex items-center justify-center space-x-2">
          <LoadingSpinner size="sm" />
          <span class="text-gray-400">Completing setup...</span>
        </div>
      )}
    </div>
  )
}

export default function Onboarding() {
  const [, setLocation] = useLocation()
  const [currentStep, setCurrentStep] = useState(0)
  const [currentToken, setCurrentToken] = useState('')
  const [projectId, setProjectId] = useState<number>()
  const [serviceId, setServiceId] = useState<number>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const token = localStorage.getItem('glinrdock_token')
        if (!token) {
          setLocation('/login')
          return
        }

        setCurrentToken(token)

        const response = await fetch('/v1/system/onboarding')
        
        if (!response.ok) {
          throw new Error('Failed to check onboarding status')
        }

        const data: OnboardingStatus = await response.json()
        
        if (!data.needed) {
          // Onboarding not needed, redirect to dashboard
          setLocation('/dashboard')
          return
        }

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load onboarding')
        setLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [setLocation])

  const handleNext = () => {
    setCurrentStep(prev => prev + 1)
  }

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }

  const handleTokenRotated = (newToken: string) => {
    setCurrentToken(newToken)
  }

  const handleProjectCreated = (id: number) => {
    setProjectId(id)
  }

  const handleServiceCreated = (id: number) => {
    setServiceId(id)
  }

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-gray-900">
        <div class="text-center">
          <LoadingSpinner size="lg" />
          <p class="text-gray-400 mt-4">Loading onboarding...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-gray-900">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <span class="text-red-400 text-2xl">!</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white mb-2">Error</h1>
            <p class="text-gray-400">{error}</p>
          </div>
          <button
            onClick={() => setLocation('/dashboard')}
            class="btn btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const steps = [
    'Secure Admin',
    'Create Project',
    'Create Service', 
    'Complete'
  ]

  return (
    <div class="min-h-screen bg-gray-900">
      <div class="max-w-2xl mx-auto py-8">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-white mb-2">Welcome to GLINR Dock</h1>
          <p class="text-gray-400">Let's get you set up in just a few steps</p>
        </div>

        {/* Progress bar */}
        <div class="mb-8">
          <div class="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div
                key={step}
                class={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  class={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    index <= currentStep
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400'
                  }`}
                >
                  {index < currentStep ? '✓' : index + 1}
                </div>
                <span
                  class={`ml-2 text-sm font-medium ${
                    index <= currentStep ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {step}
                </span>
                {index < steps.length - 1 && (
                  <div
                    class={`flex-1 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div class="card">
          <TokenRotationStep
            isActive={currentStep === 0}
            onNext={handleNext}
            currentToken={currentToken}
            onTokenRotated={handleTokenRotated}
          />

          <ProjectCreationStep
            isActive={currentStep === 1}
            onNext={handleNext}
            onPrev={handlePrev}
            onProjectCreated={handleProjectCreated}
          />

          <ServiceCreationStep
            isActive={currentStep === 2}
            onNext={handleNext}
            onPrev={handlePrev}
            projectId={projectId}
            onServiceCreated={handleServiceCreated}
          />

          <CompletionStep isActive={currentStep === 3} />
        </div>
      </div>
    </div>
  )
}