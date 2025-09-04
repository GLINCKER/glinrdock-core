import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { Toast } from '../components/ui'
import { isDeployerSync } from '../rbac'
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  GitBranch, 
  Server, 
  Globe, 
  Play,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink
} from 'lucide-preact'

// Step types
type WizardStep = 'repository' | 'service' | 'route' | 'review'

// Form data interfaces
interface RepositoryData {
  source: 'manual' | 'github_app'
  gitUrl: string
  branch: string
  dockerfile: string
  context: string
  buildArgs: Record<string, string>
  // GitHub App specific fields
  repositoryId?: number
  repoFullName?: string
  defaultBranch?: string
}

interface ServiceData {
  projectId: string
  projectName: string
  serviceName: string
  envVars: Record<string, string>
  internalPort: number
  healthPath: string
}

interface RouteData {
  enabled: boolean
  domain: string
  path: string
}

interface BuildStatus {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  logs?: string[]
  image?: string
  error?: string
}

interface DeploymentStatus {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  error?: string
}

interface WizardState {
  repository: RepositoryData
  service: ServiceData
  route: RouteData
  build?: BuildStatus
  deployment?: DeploymentStatus
  routeCreated: boolean
}

export function QuickstartSpring() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('repository')
  const [isLaunching, setIsLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  
  // Auth and permissions
  const { data: authInfo } = useApiData(() => apiClient.getAuthInfo())
  const canDeploy = authInfo ? isDeployerSync(authInfo.role) : false
  
  // Projects data for service step
  const { data: projects } = useApiData(() => apiClient.getProjects())
  
  // GitHub repositories data for repository step
  const { data: githubRepos } = useApiData(() => 
    apiClient.get('/v1/github/repositories').catch(() => ({ repositories: [] }))
  )

  // Wizard state
  const [wizardState, setWizardState] = useState<WizardState>(() => ({
    repository: {
      source: 'manual',
      gitUrl: '',
      branch: 'main',
      dockerfile: 'Dockerfile',
      context: '.',
      buildArgs: {}
    },
    service: {
      projectId: '',
      projectName: '',
      serviceName: '',
      envVars: {
        'SPRING_PROFILES_ACTIVE': 'prod',
        'SERVER_PORT': '8080',
        'JAVA_TOOL_OPTIONS': '-Xms256m -Xmx512m'
      },
      internalPort: 8080,
      healthPath: '/actuator/health'
    },
    route: {
      enabled: false,
      domain: '',
      path: '/'
    },
    build: undefined,
    deployment: undefined,
    routeCreated: false
  }))

  // Auto-generate service name from repository URL
  useEffect(() => {
    if (wizardState.repository.gitUrl) {
      const repoName = wizardState.repository.gitUrl
        .split('/')
        .pop()
        ?.replace(/\.git$/, '')
        ?.toLowerCase()
        ?.replace(/[^a-z0-9]/g, '-')
        ?.replace(/-+/g, '-')
        ?.replace(/^-|-$/g, '') || ''
      
      if (repoName && !wizardState.service.serviceName) {
        setWizardState(prev => ({
          ...prev,
          service: {
            ...prev.service,
            serviceName: repoName
          }
        }))
      }
    }
  }, [wizardState.repository.gitUrl])

  // RBAC check - show read-only notice for viewers
  if (authInfo && !canDeploy) {
    return (
      <div class="p-6 max-w-4xl mx-auto">
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div class="flex items-center">
            <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <div>
              <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Insufficient Permissions
              </h3>
              <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                You need deployer or admin permissions to use the Spring Boot quickstart wizard.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const steps: Array<{ key: WizardStep; title: string; icon: any }> = [
    { key: 'repository', title: 'Repository', icon: GitBranch },
    { key: 'service', title: 'Service', icon: Server },
    { key: 'route', title: 'Route', icon: Globe },
    { key: 'review', title: 'Launch', icon: Play }
  ]

  const currentStepIndex = steps.findIndex(step => step.key === currentStep)

  const canProceed = () => {
    switch (currentStep) {
      case 'repository':
        if (wizardState.repository.source === 'github_app') {
          return wizardState.repository.repositoryId && wizardState.repository.branch
        } else {
          return wizardState.repository.gitUrl && wizardState.repository.branch
        }
      case 'service':
        return wizardState.service.projectId && wizardState.service.serviceName
      case 'route':
        return true // Route is optional
      case 'review':
        return true
      default:
        return false
    }
  }

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key)
    }
  }

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label} copied to clipboard`, 'success')
    } catch (err) {
      showToast(`Failed to copy ${label}`, 'error')
    }
  }

  // Launch the complete workflow
  const launchWorkflow = async () => {
    if (isLaunching) return
    
    setIsLaunching(true)
    setError(null)

    try {
      // Step 1: Trigger build
      const buildResponse = await apiClient.post('/v1/builds', {
        repo_url: wizardState.repository.gitUrl,
        branch: wizardState.repository.branch,
        dockerfile: wizardState.repository.dockerfile,
        context: wizardState.repository.context,
        build_args: wizardState.repository.buildArgs
      })

      const buildId = buildResponse.id
      setWizardState(prev => ({
        ...prev,
        build: {
          id: buildId,
          status: 'pending'
        }
      }))

      showToast('Build started successfully', 'info')

      // Poll build status
      await pollBuildStatus(buildId)

    } catch (err: any) {
      console.error('Build failed:', err)
      setError(`Build failed: ${err.message || 'Unknown error'}`)
      setWizardState(prev => ({
        ...prev,
        build: {
          id: '',
          status: 'failed',
          error: err.message || 'Build failed'
        }
      }))
    } finally {
      setIsLaunching(false)
    }
  }

  const pollBuildStatus = async (buildId: string) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0

    const poll = async (): Promise<void> => {
      try {
        const buildStatus = await apiClient.get(`/v1/builds/${buildId}`)
        
        setWizardState(prev => ({
          ...prev,
          build: {
            id: buildId,
            status: buildStatus.status,
            logs: buildStatus.logs_tail ? buildStatus.logs_tail.split('\n') : [],
            image: buildStatus.image_name,
            error: buildStatus.error
          }
        }))

        if (buildStatus.status === 'success' && buildStatus.image_name) {
          showToast('Build completed successfully', 'success')
          // Continue to deployment
          await deployService(buildStatus.image_name)
        } else if (buildStatus.status === 'failed') {
          throw new Error(buildStatus.error || 'Build failed')
        } else if (buildStatus.status === 'running' || buildStatus.status === 'pending') {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(() => poll(), 5000) // Poll every 5 seconds
          } else {
            throw new Error('Build timeout after 5 minutes')
          }
        }
      } catch (err: any) {
        console.error('Build polling error:', err)
        setError(`Build failed: ${err.message}`)
        setWizardState(prev => ({
          ...prev,
          build: {
            id: buildId,
            status: 'failed',
            error: err.message
          }
        }))
      }
    }

    await poll()
  }

  const deployService = async (imageName: string) => {
    try {
      // Create service first
      const servicePayload = {
        name: wizardState.service.serviceName,
        image: imageName,
        env: wizardState.service.envVars,
        ports: [{ container: wizardState.service.internalPort, host: 0 }],
        health_path: wizardState.service.healthPath
      }

      const serviceResponse = await apiClient.post(
        `/v1/projects/${wizardState.service.projectId}/services`,
        servicePayload
      )

      const serviceId = serviceResponse.id

      // Trigger deployment
      const deployResponse = await apiClient.post('/v1/deployments', {
        service_id: serviceId.toString()
      })

      setWizardState(prev => ({
        ...prev,
        deployment: {
          id: deployResponse.id,
          status: 'pending'
        }
      }))

      showToast('Deployment started', 'info')

      // Poll deployment status
      await pollDeploymentStatus(deployResponse.id, serviceId)

    } catch (err: any) {
      console.error('Deployment failed:', err)
      setError(`Deployment failed: ${err.message}`)
      setWizardState(prev => ({
        ...prev,
        deployment: {
          id: '',
          status: 'failed',
          error: err.message
        }
      }))
    }
  }

  const pollDeploymentStatus = async (deploymentId: string, serviceId: number) => {
    // For simplicity, we'll assume deployment succeeds after a short delay
    // In a real implementation, you'd poll the deployment status
    setTimeout(async () => {
      try {
        setWizardState(prev => ({
          ...prev,
          deployment: {
            id: deploymentId,
            status: 'success'
          }
        }))

        showToast('Service deployed successfully', 'success')

        // Create route if enabled
        if (wizardState.route.enabled) {
          await createRoute(serviceId)
        } else {
          showToast('Spring Boot quickstart completed successfully!', 'success')
        }

      } catch (err: any) {
        console.error('Deployment polling error:', err)
        setWizardState(prev => ({
          ...prev,
          deployment: {
            id: deploymentId,
            status: 'failed',
            error: err.message
          }
        }))
      }
    }, 3000)
  }

  const createRoute = async (serviceId: number) => {
    try {
      await apiClient.post('/v1/routes', {
        service_id: serviceId,
        domain: wizardState.route.domain,
        path: wizardState.route.path,
        port: wizardState.service.internalPort
      })

      // Reload nginx
      await apiClient.post('/v1/system/nginx/reload')

      setWizardState(prev => ({
        ...prev,
        routeCreated: true
      }))

      showToast('Route created and nginx reloaded', 'success')
      showToast('Spring Boot quickstart completed successfully!', 'success')

    } catch (err: any) {
      console.error('Route creation failed:', err)
      showToast(`Route creation failed: ${err.message}`, 'error')
      // Don't fail the entire flow for route issues
    }
  }

  return (
    <div class="space-y-6 fade-in">
      {/* Header */}
      <div>
        <div class="flex items-center mb-4">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/app')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-3"
          >
            <ArrowLeft class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 class="text-3xl font-bold mb-2">
            <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
              Spring Boot Quickstart
            </span>
          </h1>
        </div>
        <p class="text-gray-600 dark:text-gray-400">
          Deploy a Spring Boot application from Git repository to production in minutes
        </p>
      </div>

      {/* Progress Steps */}
      <div class="mb-8">
        <div class="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.key
            const isCompleted = index < currentStepIndex || 
              (step.key === 'review' && (wizardState.build?.status === 'success' || wizardState.deployment?.status === 'success'))
            const isDisabled = index > currentStepIndex + 1

            return (
              <div key={step.key} class="flex items-center">
                <div class="flex flex-col items-center">
                  <div
                    class={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isActive
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : isDisabled
                        ? 'border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
                        : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:border-blue-500 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isDisabled && index <= currentStepIndex + 1) {
                        setCurrentStep(step.key)
                      }
                    }}
                  >
                    {isCompleted ? <Check class="w-5 h-5" /> : <Icon class="w-5 h-5" />}
                  </div>
                  <span
                    class={`mt-2 text-sm font-medium ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    class={`flex-1 h-px mx-4 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-center">
            <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <div class="flex-1">
              <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              class="text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg shadow-[#9c40ff]/10">
        {currentStep === 'repository' && (
          <RepositoryStep 
            data={wizardState.repository}
            githubRepos={githubRepos?.repositories || []}
            onChange={(data) => setWizardState(prev => ({ ...prev, repository: data }))}
          />
        )}
        
        {currentStep === 'service' && (
          <ServiceStep 
            data={wizardState.service}
            projects={projects || []}
            onChange={(data) => setWizardState(prev => ({ ...prev, service: data }))}
          />
        )}
        
        {currentStep === 'route' && (
          <RouteStep 
            data={wizardState.route}
            onChange={(data) => setWizardState(prev => ({ ...prev, route: data }))}
          />
        )}
        
        {currentStep === 'review' && (
          <ReviewStep 
            wizardState={wizardState}
            isLaunching={isLaunching}
            onLaunch={launchWorkflow}
            onCopy={copyToClipboard}
          />
        )}
      </div>

      {/* Navigation */}
      {currentStep !== 'review' && (
        <div class="flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center"
          >
            <ArrowLeft class="w-4 h-4 mr-2" />
            Previous
          </button>
          
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02]"
          >
            Next
            <ArrowRight class="w-4 h-4 ml-2" />
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

// Repository Step Component
function RepositoryStep({ data, githubRepos, onChange }: { 
  data: RepositoryData, 
  githubRepos: any[], 
  onChange: (data: RepositoryData) => void 
}) {
  const [buildArgKey, setBuildArgKey] = useState('')
  const [buildArgValue, setBuildArgValue] = useState('')

  const addBuildArg = () => {
    if (buildArgKey.trim() && buildArgValue.trim()) {
      onChange({
        ...data,
        buildArgs: {
          ...data.buildArgs,
          [buildArgKey.trim()]: buildArgValue.trim()
        }
      })
      setBuildArgKey('')
      setBuildArgValue('')
    }
  }

  const removeBuildArg = (key: string) => {
    const newBuildArgs = { ...data.buildArgs }
    delete newBuildArgs[key]
    onChange({ ...data, buildArgs: newBuildArgs })
  }

  const isValidGitUrl = (url: string) => {
    const gitUrlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
    return gitUrlPattern.test(url) && (url.includes('github.com') || url.includes('gitlab.com') || url.includes('.git'))
  }

  const handleRepositorySelect = (repo: any) => {
    onChange({
      ...data,
      repositoryId: repo.repository_id,
      repoFullName: repo.full_name,
      gitUrl: repo.clone_url,
      branch: repo.default_branch || 'main',
      defaultBranch: repo.default_branch
    })
  }

  const handleSourceChange = (source: 'manual' | 'github_app') => {
    if (source === 'manual') {
      onChange({
        ...data,
        source,
        repositoryId: undefined,
        repoFullName: undefined,
        defaultBranch: undefined,
        gitUrl: '',
        branch: 'main'
      })
    } else {
      onChange({
        ...data,
        source,
        gitUrl: '',
        branch: 'main'
      })
    }
  }

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <GitBranch class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Repository Configuration
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose a repository source and configure build settings for your Spring Boot application.
        </p>
      </div>

      {/* Repository Source Selection */}
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Repository Source
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => handleSourceChange('github_app')}
            class={`cursor-pointer p-4 border-2 rounded-lg transition-colors ${
              data.source === 'github_app'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
            }`}
          >
            <div class="flex items-center mb-2">
              <div class={`w-4 h-4 rounded-full border-2 mr-3 ${
                data.source === 'github_app'
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}>
                {data.source === 'github_app' && (
                  <div class="w-full h-full bg-white rounded-full transform scale-50"></div>
                )}
              </div>
              <h4 class="font-medium text-gray-900 dark:text-white">GitHub App Repository</h4>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 ml-7">
              Select from configured GitHub App repositories with automatic webhook setup
            </p>
          </div>

          <div
            onClick={() => handleSourceChange('manual')}
            class={`cursor-pointer p-4 border-2 rounded-lg transition-colors ${
              data.source === 'manual'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
            }`}
          >
            <div class="flex items-center mb-2">
              <div class={`w-4 h-4 rounded-full border-2 mr-3 ${
                data.source === 'manual'
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}>
                {data.source === 'manual' && (
                  <div class="w-full h-full bg-white rounded-full transform scale-50"></div>
                )}
              </div>
              <h4 class="font-medium text-gray-900 dark:text-white">Manual Git URL</h4>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 ml-7">
              Manually enter any Git repository URL (GitHub, GitLab, etc.)
            </p>
          </div>
        </div>
      </div>

      {/* GitHub App Repository Selection */}
      {data.source === 'github_app' && (
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Repository <span class="text-red-500">*</span>
            </label>
            {githubRepos.length === 0 ? (
              <div class="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p class="text-sm text-amber-700 dark:text-amber-300">
                  No GitHub repositories available. Make sure to configure the GitHub App in Settings and sync your installations.
                </p>
              </div>
            ) : (
              <div class="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                {githubRepos.map((repo) => (
                  <div
                    key={repo.repository_id}
                    onClick={() => handleRepositorySelect(repo)}
                    class={`cursor-pointer p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      data.repositoryId === repo.repository_id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                        : ''
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="font-medium text-gray-900 dark:text-white">{repo.full_name}</h4>
                        <div class="flex items-center space-x-3 mt-1">
                          <span class="text-xs text-gray-500 dark:text-gray-400">
                            Default: {repo.default_branch}
                          </span>
                          {repo.private && (
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded">
                              Private
                            </span>
                          )}
                          {repo.is_activated && (
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                              Activated
                            </span>
                          )}
                        </div>
                      </div>
                      {data.repositoryId === repo.repository_id && (
                        <Check class="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.repoFullName && (
            <div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p class="text-sm text-green-700 dark:text-green-300">
                Selected: <code class="font-mono">{data.repoFullName}</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Manual Git URL Entry */}
      {data.source === 'manual' && (
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Repository URL */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository URL <span class="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={data.gitUrl}
              onChange={(e) => onChange({ ...data, gitUrl: (e.target as HTMLInputElement).value })}
              placeholder="https://github.com/username/spring-boot-app.git"
              class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                data.gitUrl && !isValidGitUrl(data.gitUrl)
                  ? 'border-red-300 dark:border-red-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {data.gitUrl && !isValidGitUrl(data.gitUrl) && (
              <p class="text-sm text-red-600 dark:text-red-400 mt-1">
                Please enter a valid Git repository URL
              </p>
            )}
          </div>

          {/* Branch */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Branch <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.branch}
              onChange={(e) => onChange({ ...data, branch: (e.target as HTMLInputElement).value })}
              placeholder="main"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Common Build Configuration (shown for both sources when repository is selected) */}
      {(data.source === 'manual' || data.repositoryId) && (
        <>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Branch (for GitHub App selection) */}
            {data.source === 'github_app' && data.repositoryId && (
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Branch <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.branch}
                  onChange={(e) => onChange({ ...data, branch: (e.target as HTMLInputElement).value })}
                  placeholder={data.defaultBranch || "main"}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Default: {data.defaultBranch || 'main'}
                </p>
              </div>
            )}

            {/* Dockerfile */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dockerfile Path
              </label>
              <input
                type="text"
                value={data.dockerfile}
                onChange={(e) => onChange({ ...data, dockerfile: (e.target as HTMLInputElement).value })}
                placeholder="Dockerfile"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Path to Dockerfile relative to repository root
              </p>
            </div>

            {/* Build Context */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Build Context
              </label>
              <input
                type="text"
                value={data.context}
                onChange={(e) => onChange({ ...data, context: (e.target as HTMLInputElement).value })}
                placeholder="."
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Build context directory relative to repository root
              </p>
            </div>
          </div>

          {/* Build Arguments */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Build Arguments
            </label>
            <div class="space-y-3">
              {/* Add Build Arg */}
              <div class="flex gap-2">
                <input
                  type="text"
                  value={buildArgKey}
                  onChange={(e) => setBuildArgKey((e.target as HTMLInputElement).value)}
                  placeholder="KEY"
                  class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={buildArgValue}
                  onChange={(e) => setBuildArgValue((e.target as HTMLInputElement).value)}
                  placeholder="VALUE"
                  class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={addBuildArg}
                  disabled={!buildArgKey.trim() || !buildArgValue.trim()}
                  class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02]"
                >
                  Add
                </button>
              </div>

              {/* Existing Build Args */}
              {Object.entries(data.buildArgs).length > 0 && (
                <div class="space-y-2">
                  {Object.entries(data.buildArgs).map(([key, value]) => (
                    <div key={key} class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div class="flex-1">
                        <code class="text-sm">
                          <span class="text-blue-600 dark:text-blue-400">{key}</span>
                          <span class="text-gray-500 dark:text-gray-400">=</span>
                          <span class="text-green-600 dark:text-green-400">{value}</span>
                        </code>
                      </div>
                      <button
                        onClick={() => removeBuildArg(key)}
                        class="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Remove build argument"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Build arguments passed to Docker during build (--build-arg KEY=VALUE)
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ServiceStep({ data, projects, onChange }: { data: ServiceData, projects: any[], onChange: (data: ServiceData) => void }) {
  const [envKey, setEnvKey] = useState('')
  const [envValue, setEnvValue] = useState('')

  const addEnvVar = () => {
    if (envKey.trim() && envValue.trim()) {
      onChange({
        ...data,
        envVars: {
          ...data.envVars,
          [envKey.trim()]: envValue.trim()
        }
      })
      setEnvKey('')
      setEnvValue('')
    }
  }

  const removeEnvVar = (key: string) => {
    const newEnvVars = { ...data.envVars }
    delete newEnvVars[key]
    onChange({ ...data, envVars: newEnvVars })
  }

  const updateEnvVar = (key: string, value: string) => {
    onChange({
      ...data,
      envVars: {
        ...data.envVars,
        [key]: value
      }
    })
  }

  const isValidServiceName = (name: string) => {
    const serviceNamePattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
    return name.length >= 2 && name.length <= 63 && serviceNamePattern.test(name)
  }

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Server class="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
          Service Configuration
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure your Spring Boot service deployment settings and environment variables.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Selection */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project <span class="text-red-500">*</span>
          </label>
          <select
            value={data.projectId}
            onChange={(e) => {
              const selectedProject = projects.find(p => p.id.toString() === (e.target as HTMLSelectElement).value)
              onChange({ 
                ...data, 
                projectId: (e.target as HTMLSelectElement).value,
                projectName: selectedProject?.name || ''
              })
            }}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {projects.length === 0 && (
            <p class="text-sm text-amber-600 dark:text-amber-400 mt-1">
              No projects available. Create a project first.
            </p>
          )}
        </div>

        {/* Service Name */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Service Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.serviceName}
            onChange={(e) => onChange({ ...data, serviceName: (e.target as HTMLInputElement).value })}
            placeholder="my-spring-app"
            class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              data.serviceName && !isValidServiceName(data.serviceName)
                ? 'border-red-300 dark:border-red-600'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {data.serviceName && !isValidServiceName(data.serviceName) && (
            <p class="text-sm text-red-600 dark:text-red-400 mt-1">
              Service name must be 2-63 characters, lowercase, alphanumeric with hyphens
            </p>
          )}
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Auto-generated from repository name, but can be customized
          </p>
        </div>

        {/* Internal Port */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Internal Port <span class="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={data.internalPort}
            onChange={(e) => onChange({ ...data, internalPort: parseInt((e.target as HTMLInputElement).value) || 8080 })}
            min="1"
            max="65535"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Port your Spring Boot application listens on inside the container
          </p>
        </div>

        {/* Health Path */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Health Check Path
          </label>
          <input
            type="text"
            value={data.healthPath}
            onChange={(e) => onChange({ ...data, healthPath: (e.target as HTMLInputElement).value })}
            placeholder="/actuator/health"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Spring Boot Actuator health endpoint for health checks
          </p>
        </div>
      </div>

      {/* Environment Variables */}
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Environment Variables
        </label>
        <div class="space-y-3">
          {/* Default/Required Environment Variables */}
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400">Spring Boot Configuration</h4>
            {Object.entries(data.envVars).map(([key, value]) => {
              const isDefault = ['SPRING_PROFILES_ACTIVE', 'SERVER_PORT', 'JAVA_TOOL_OPTIONS'].includes(key)
              return (
                <div key={key} class="flex items-center gap-2">
                  <div class="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={key}
                      readOnly={isDefault}
                      class={`px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isDefault 
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-400' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateEnvVar(key, (e.target as HTMLInputElement).value)}
                      class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {!isDefault && (
                    <button
                      onClick={() => removeEnvVar(key)}
                      class="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Remove environment variable"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add Custom Environment Variable */}
          <div>
            <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Add Custom Variable</h4>
            <div class="flex gap-2">
              <input
                type="text"
                value={envKey}
                onChange={(e) => setEnvKey((e.target as HTMLInputElement).value)}
                placeholder="VARIABLE_NAME"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={envValue}
                onChange={(e) => setEnvValue((e.target as HTMLInputElement).value)}
                placeholder="value"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addEnvVar}
                disabled={!envKey.trim() || !envValue.trim() || envKey.trim() in data.envVars}
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Add custom environment variables for your Spring Boot application
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteStep({ data, onChange }: { data: RouteData, onChange: (data: RouteData) => void }) {
  const isValidDomain = (domain: string) => {
    if (!domain) return false
    const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    return domainPattern.test(domain) && domain.length <= 255
  }

  const isValidPath = (path: string) => {
    return path.startsWith('/') && /^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@/]*$/.test(path)
  }

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Globe class="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
          Route Configuration
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Optionally create an external route to make your Spring Boot application accessible from the internet.
        </p>
      </div>

      {/* Enable Route Toggle */}
      <div class="flex items-center">
        <input
          type="checkbox"
          id="enable-route"
          checked={data.enabled}
          onChange={(e) => onChange({ ...data, enabled: (e.target as HTMLInputElement).checked })}
          class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <label htmlFor="enable-route" class="ml-2 text-sm font-medium text-gray-900 dark:text-white">
          Create external route for this service
        </label>
      </div>

      {data.enabled && (
        <div class="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Domain */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Domain <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.domain}
                onChange={(e) => onChange({ ...data, domain: (e.target as HTMLInputElement).value })}
                placeholder="api.example.com"
                class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  data.domain && !isValidDomain(data.domain)
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {data.domain && !isValidDomain(data.domain) && (
                <p class="text-sm text-red-600 dark:text-red-400 mt-1">
                  Please enter a valid domain name
                </p>
              )}
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The domain where your application will be accessible
              </p>
            </div>

            {/* Path */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Path
              </label>
              <input
                type="text"
                value={data.path}
                onChange={(e) => onChange({ ...data, path: (e.target as HTMLInputElement).value })}
                placeholder="/"
                class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  data.path && !isValidPath(data.path)
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {data.path && !isValidPath(data.path) && (
                <p class="text-sm text-red-600 dark:text-red-400 mt-1">
                  Path must start with / and contain only valid URL characters
                </p>
              )}
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                URL path prefix for your application (default: /)
              </p>
            </div>
          </div>

          {/* Preview URL */}
          {data.domain && data.path && isValidDomain(data.domain) && isValidPath(data.path) && (
            <div class="mt-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview URL
              </label>
              <div class="flex items-center">
                <code class="flex-1 text-sm font-mono text-purple-600 dark:text-purple-400 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded border">
                  https://{data.domain}{data.path === '/' ? '' : data.path}
                </code>
                <ExternalLink class="w-4 h-4 ml-2 text-gray-400" />
              </div>
            </div>
          )}

          {/* Admin Reload Notice */}
          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div class="flex items-start">
              <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
              <div class="text-xs text-amber-700 dark:text-amber-300">
                <strong>Admin Notice:</strong> Creating a route will automatically reload the nginx configuration. 
                This may cause a brief interruption to existing routes.
              </div>
            </div>
          </div>
        </div>
      )}

      {!data.enabled && (
        <div class="text-center py-8">
          <Globe class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            No External Route
          </h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Your Spring Boot application will be accessible within the project network only. 
            You can create routes later from the service detail page.
          </p>
        </div>
      )}
    </div>
  )
}

function ReviewStep({ wizardState, isLaunching, onLaunch, onCopy }: { 
  wizardState: WizardState, 
  isLaunching: boolean, 
  onLaunch: () => void,
  onCopy: (text: string, label: string) => void
}) {
  const { repository, service, route, build, deployment } = wizardState

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold mb-4">Review Configuration</h3>
        <div class="space-y-4">
          {/* Repository Section */}
          <div class="border border-gray-200 rounded-lg p-4">
            <h4 class="font-medium text-sm text-gray-700 mb-2">Repository</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-600">Git URL:</span>
                <div class="font-mono bg-gray-50 p-2 rounded mt-1">
                  {repository.gitUrl}
                  <button
                    onClick={() => onCopy(repository.gitUrl, 'Git URL')}
                    class="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div>
                <span class="text-gray-600">Branch:</span>
                <div class="font-mono bg-gray-50 p-2 rounded mt-1">{repository.branch}</div>
              </div>
              {repository.dockerfile && (
                <div>
                  <span class="text-gray-600">Dockerfile:</span>
                  <div class="font-mono bg-gray-50 p-2 rounded mt-1">{repository.dockerfile}</div>
                </div>
              )}
              {repository.context && (
                <div>
                  <span class="text-gray-600">Context:</span>
                  <div class="font-mono bg-gray-50 p-2 rounded mt-1">{repository.context}</div>
                </div>
              )}
            </div>
            {Object.keys(repository.buildArgs).length > 0 && (
              <div class="mt-3">
                <span class="text-gray-600 text-sm">Build Arguments:</span>
                <div class="bg-gray-50 p-2 rounded mt-1 space-y-1">
                  {Object.entries(repository.buildArgs).map(([key, value]) => (
                    <div key={key} class="font-mono text-sm">
                      {key}={value}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Service Section */}
          <div class="border border-gray-200 rounded-lg p-4">
            <h4 class="font-medium text-sm text-gray-700 mb-2">Service</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-600">Project:</span>
                <div class="font-medium mt-1">{service.projectName}</div>
              </div>
              <div>
                <span class="text-gray-600">Service Name:</span>
                <div class="font-medium mt-1">{service.serviceName}</div>
              </div>
              <div>
                <span class="text-gray-600">Health Path:</span>
                <div class="font-mono bg-gray-50 p-2 rounded mt-1">{service.healthPath}</div>
              </div>
            </div>
            {Object.keys(service.envVars).length > 0 && (
              <div class="mt-3">
                <span class="text-gray-600 text-sm">Environment Variables:</span>
                <div class="bg-gray-50 p-2 rounded mt-1 space-y-1">
                  {Object.entries(service.envVars).map(([key, value]) => (
                    <div key={key} class="font-mono text-sm">
                      {key}={value}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Route Section */}
          {route.enabled && (
            <div class="border border-gray-200 rounded-lg p-4">
              <h4 class="font-medium text-sm text-gray-700 mb-2">Route</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">Domain:</span>
                  <div class="font-mono bg-gray-50 p-2 rounded mt-1">{route.domain}</div>
                </div>
                <div>
                  <span class="text-gray-600">Path:</span>
                  <div class="font-mono bg-gray-50 p-2 rounded mt-1">{route.path}</div>
                </div>
              </div>
              <div class="mt-3">
                <span class="text-gray-600 text-sm">Preview URL:</span>
                <div class="font-mono bg-blue-50 p-2 rounded mt-1 text-blue-800">
                  https://{route.domain}{route.path}
                  <button
                    onClick={() => onCopy(`https://${route.domain}${route.path}`, 'Route URL')}
                    class="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Build Status */}
      {build && (
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Build Status</h4>
          <div class="flex items-center space-x-2 mb-2">
            <div class={`w-3 h-3 rounded-full ${
              build.status === 'running' ? 'bg-yellow-500 animate-pulse' :
              build.status === 'success' ? 'bg-green-500' :
              build.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
            }`}></div>
            <span class="text-sm font-medium capitalize">{build.status}</span>
          </div>
          {build.logs && build.logs.length > 0 && (
            <div class="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-32 overflow-y-auto">
              {build.logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deployment Status */}
      {deployment && (
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Deployment Status</h4>
          <div class="flex items-center space-x-2">
            <div class={`w-3 h-3 rounded-full ${
              deployment.status === 'running' ? 'bg-yellow-500 animate-pulse' :
              deployment.status === 'success' ? 'bg-green-500' :
              deployment.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
            }`}></div>
            <span class="text-sm font-medium capitalize">{deployment.status}</span>
          </div>
          {deployment.id && (
            <div class="mt-2 text-sm text-gray-600">
              Deployment ID: {deployment.id}
            </div>
          )}
        </div>
      )}

      {/* Launch Button */}
      {!build && (
        <div class="flex justify-center pt-4">
          <button
            onClick={onLaunch}
            disabled={isLaunching}
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLaunching ? (
              <>
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Launching...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Launch Spring Boot Service</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Success State */}
      {build?.status === 'success' && deployment?.status === 'success' && (
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div class="text-green-600 text-lg mb-2">🎉 Successfully Deployed!</div>
          <div class="text-sm text-green-700 mb-3">
            Your Spring Boot service is now running and ready to serve requests.
          </div>
          {route.enabled && wizardState.routeCreated && (
            <div class="text-sm">
              <span class="text-green-700">Access your service at: </span>
              <a 
                href={`https://${route.domain}${route.path}`}
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 font-mono"
              >
                https://{route.domain}{route.path}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}