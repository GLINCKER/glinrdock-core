import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { Toast } from '../components/ui'
import { 
  Rocket, 
  Code, 
  Server, 
  Shield, 
  Database, 
  Zap,
  Home,
  Github,
  Globe,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  PlayCircle,
  ArrowRight,
  Sparkles,
  Coffee
} from 'lucide-preact'
import { Link } from 'wouter'
import { Breadcrumb } from '../components/Breadcrumb'
import { usePageTitle } from '../hooks/usePageTitle'

// Types matching backend
interface DeploymentTemplate {
  id: string
  name: string
  description: string
  framework: string
  language: string
  build_tool: string
  dockerfile: string
  env_vars: { [key: string]: string }
  ports: number[]
  health_check: string
  config: { [key: string]: any }
  created_at: string
}

interface DeploymentRequest {
  project_id: number
  service_name: string
  template_id?: string
  repository?: string
  branch?: string
  dockerfile?: string
  env_vars?: { [key: string]: string }
  ports?: number[]
  auto_route?: boolean
  domain?: string
  enable_ssl?: boolean
  build_args?: { [key: string]: string }
}

interface AutoDetectionResult {
  framework: string
  language: string
  build_tool: string
  ports: number[]
  env_vars: { [key: string]: string }
  health_check: string
  config: { [key: string]: any }
  confidence: number
}

export function Deploy() {
  usePageTitle("Deploy");
  
  const [activeStep, setActiveStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<DeploymentTemplate | null>(null)
  const [deploymentRequest, setDeploymentRequest] = useState<DeploymentRequest>({
    project_id: 0,
    service_name: '',
    ports: [8080],
    env_vars: {},
    auto_route: true,
    enable_ssl: true
  })
  
  const [toastConfig, setToastConfig] = useState({ 
    show: false, 
    message: '', 
    type: 'info' as 'info' | 'success' | 'error' 
  })
  
  const [deploying, setDeploying] = useState(false)
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [autoDetectionResult, setAutoDetectionResult] = useState<AutoDetectionResult | null>(null)

  // Fetch data
  const { data: projects } = useApiData(() => apiClient.getProjects())
  const { data: templates, loading: templatesLoading } = useApiData(() => 
    fetch('/v1/deploy/templates', {
      headers: { 'Authorization': `Bearer ${apiClient.getStoredToken()}` }
    }).then(res => res.json())
  )

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const steps = [
    { title: "Template", icon: Code, desc: "Choose deployment template" },
    { title: "Configure", icon: Settings, desc: "Configure your application" },
    { title: "Deploy", icon: Rocket, desc: "Deploy to production" }
  ]

  const handleTemplateSelect = (template: DeploymentTemplate) => {
    setSelectedTemplate(template)
    setDeploymentRequest(prev => ({
      ...prev,
      template_id: template.id,
      ports: template.ports,
      env_vars: template.env_vars
    }))
    setActiveStep(1)
  }

  const handleAutoDetect = async () => {
    if (!deploymentRequest.repository) {
      showToast('Please enter a repository URL first', 'error')
      return
    }

    setAutoDetecting(true)
    try {
      const response = await fetch('/v1/deploy/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getStoredToken()}`
        },
        body: JSON.stringify({
          repository: deploymentRequest.repository,
          branch: deploymentRequest.branch || 'main'
        })
      })

      if (!response.ok) throw new Error('Failed to auto-detect project')
      
      const result: AutoDetectionResult = await response.json()
      setAutoDetectionResult(result)
      
      // Find matching template
      const matchingTemplate = templates?.templates?.find((t: DeploymentTemplate) => 
        t.framework === result.framework && t.build_tool === result.build_tool
      )
      
      if (matchingTemplate) {
        handleTemplateSelect(matchingTemplate)
      }
      
      showToast(`Auto-detected ${result.framework} project with ${Math.round(result.confidence * 100)}% confidence`, 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to auto-detect project', 'error')
    } finally {
      setAutoDetecting(false)
    }
  }

  const handleDeploy = async () => {
    if (!selectedTemplate || !deploymentRequest.project_id || !deploymentRequest.service_name) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    setDeploying(true)
    try {
      const response = await fetch('/v1/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getStoredToken()}`
        },
        body: JSON.stringify(deploymentRequest)
      })

      if (!response.ok) throw new Error('Deployment failed')
      
      const result = await response.json()
      showToast(`Service "${result.service_name}" deployed successfully!`, 'success')
      setActiveStep(2)
    } catch (error: any) {
      showToast(error.message || 'Deployment failed', 'error')
    } finally {
      setDeploying(false)
    }
  }

  const getFrameworkIcon = (framework: string) => {
    switch (framework) {
      case 'spring-boot': return <Coffee class="w-5 h-5" />
      case 'express': return <Server class="w-5 h-5" />
      default: return <Code class="w-5 h-5" />
    }
  }

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/", icon: Home },
            { label: "Deploy", active: true, icon: Rocket },
          ]}
          className="text-gray-600 dark:text-gray-300"
        />

        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                Deploy Application
              </span>
            </h1>
            <p class="text-gray-700 dark:text-gray-300 text-base">
              Deploy your Spring Boot apps with automatic SSL certificates and nginx routing
            </p>
          </div>
          <div class="flex items-center space-x-2">
            <Sparkles class="w-5 h-5 text-purple-500 animate-pulse" />
            <span class="text-sm text-purple-600 dark:text-purple-400 font-medium">Production Ready</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-lg dark:shadow-xl mb-8">
          <div class="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === activeStep
              const isCompleted = index < activeStep
              
              return (
                <div key={index} class="flex items-center">
                  <div class={`flex items-center space-x-3 ${isActive ? 'text-purple-600 dark:text-purple-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    <div class={`p-3 rounded-xl ${
                      isActive ? 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30' :
                      isCompleted ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30' :
                      'bg-gray-100 dark:bg-gray-800/50'
                    }`}>
                      {isCompleted ? <CheckCircle class="w-6 h-6" /> : <Icon class="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 class="font-semibold">{step.title}</h3>
                      <p class="text-sm opacity-75">{step.desc}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight class="w-5 h-5 text-gray-300 dark:text-gray-600 mx-6" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content */}
        {activeStep === 0 && (
          <div class="space-y-6">
            {/* Quick Deploy with Auto-Detection */}
            <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-lg dark:shadow-xl">
              <div class="flex items-center gap-3 mb-6">
                <div class="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
                  <Github class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Quick Deploy from Repository</h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Auto-detect your project and deploy instantly</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repository URL</label>
                  <input
                    type="text"
                    placeholder="https://github.com/user/repo"
                    value={deploymentRequest.repository || ''}
                    onInput={(e) => setDeploymentRequest(prev => ({ 
                      ...prev, 
                      repository: (e.target as HTMLInputElement).value 
                    }))}
                    class="input"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Branch</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={deploymentRequest.branch || ''}
                    onInput={(e) => setDeploymentRequest(prev => ({ 
                      ...prev, 
                      branch: (e.target as HTMLInputElement).value 
                    }))}
                    class="input"
                  />
                </div>
                <div class="flex items-end">
                  <button
                    onClick={handleAutoDetect}
                    disabled={autoDetecting || !deploymentRequest.repository}
                    class="btn btn-primary w-full"
                  >
                    {autoDetecting ? (
                      <>
                        <Clock class="w-4 h-4 animate-spin mr-2" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <Zap class="w-4 h-4 mr-2" />
                        Auto-Detect & Deploy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {autoDetectionResult && (
                <div class="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                  <div class="flex items-center space-x-2 mb-2">
                    <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span class="font-medium text-green-700 dark:text-green-300">
                      Detected: {autoDetectionResult.framework} ({autoDetectionResult.build_tool})
                    </span>
                    <span class="bg-green-100 dark:bg-green-800/30 text-green-600 dark:text-green-400 px-2 py-1 rounded text-xs">
                      {Math.round(autoDetectionResult.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p class="text-sm text-green-600 dark:text-green-400">
                    Ports: {autoDetectionResult.ports.join(', ')} • Health check: {autoDetectionResult.health_check}
                  </p>
                </div>
              )}
            </div>

            {/* Template Selection */}
            <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-lg dark:shadow-xl">
              <div class="flex items-center gap-3 mb-6">
                <div class="p-2 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl">
                  <Code class="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Or Choose Template</h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Select from optimized deployment templates</p>
                </div>
              </div>

              {templatesLoading ? (
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} class="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl p-6 h-32"></div>
                  ))}
                </div>
              ) : (
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates?.templates?.map((template: DeploymentTemplate) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      class="group p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/30 
                             border border-gray-200 dark:border-gray-700/50 rounded-xl 
                             hover:from-purple-50 hover:to-indigo-50 dark:hover:from-purple-900/20 dark:hover:to-indigo-900/20
                             hover:border-purple-200 dark:hover:border-purple-700/50
                             transition-all duration-300 shadow-lg hover:shadow-xl 
                             hover:scale-[1.02] text-left"
                    >
                      <div class="flex items-center gap-3 mb-3">
                        <div class="p-2 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-lg">
                          {getFrameworkIcon(template.framework)}
                        </div>
                        <div>
                          <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                            {template.name}
                          </h3>
                          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">
                            {template.language} • {template.build_tool}
                          </p>
                        </div>
                      </div>
                      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {template.description}
                      </p>
                      <div class="flex items-center justify-between text-xs">
                        <div class="flex space-x-2">
                          {template.ports.map(port => (
                            <span key={port} class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">:{port}</span>
                          ))}
                        </div>
                        <PlayCircle class="w-4 h-4 text-purple-500 group-hover:text-purple-600 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 1 && selectedTemplate && (
          <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-lg dark:shadow-xl">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-gradient-to-br from-green-100 to-teal-100 dark:from-green-900/30 dark:to-teal-900/30 rounded-xl">
                <Settings class="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Configure Deployment</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">Template: {selectedTemplate.name}</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Configuration */}
              <div class="space-y-4">
                <h3 class="font-medium text-gray-900 dark:text-white">Basic Configuration</h3>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project</label>
                  <select
                    value={deploymentRequest.project_id}
                    onChange={(e) => setDeploymentRequest(prev => ({ 
                      ...prev, 
                      project_id: parseInt((e.target as HTMLSelectElement).value) 
                    }))}
                    class="input"
                  >
                    <option value={0}>Select a project</option>
                    {projects?.projects?.map((project: any) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Service Name</label>
                  <input
                    type="text"
                    placeholder="my-spring-app"
                    value={deploymentRequest.service_name}
                    onInput={(e) => setDeploymentRequest(prev => ({ 
                      ...prev, 
                      service_name: (e.target as HTMLInputElement).value 
                    }))}
                    class="input"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ports</label>
                  <input
                    type="text"
                    placeholder="8080,8443"
                    value={deploymentRequest.ports?.join(',') || ''}
                    onInput={(e) => setDeploymentRequest(prev => ({ 
                      ...prev, 
                      ports: (e.target as HTMLInputElement).value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p))
                    }))}
                    class="input"
                  />
                </div>
              </div>

              {/* Routing Configuration */}
              <div class="space-y-4">
                <h3 class="font-medium text-gray-900 dark:text-white">Automatic Routing</h3>
                
                <div class="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="auto-route"
                    checked={deploymentRequest.auto_route}
                    onChange={(e) => setDeploymentRequest(prev => ({ 
                      ...prev, 
                      auto_route: (e.target as HTMLInputElement).checked 
                    }))}
                    class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label for="auto-route" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Create nginx route automatically
                  </label>
                </div>

                {deploymentRequest.auto_route && (
                  <>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Domain</label>
                      <input
                        type="text"
                        placeholder="api.yourdomain.com"
                        value={deploymentRequest.domain || ''}
                        onInput={(e) => setDeploymentRequest(prev => ({ 
                          ...prev, 
                          domain: (e.target as HTMLInputElement).value 
                        }))}
                        class="input"
                      />
                    </div>

                    <div class="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enable-ssl"
                        checked={deploymentRequest.enable_ssl}
                        onChange={(e) => setDeploymentRequest(prev => ({ 
                          ...prev, 
                          enable_ssl: (e.target as HTMLInputElement).checked 
                        }))}
                        class="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <label for="enable-ssl" class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Shield class="w-4 h-4 mr-1 text-green-500" />
                        Enable SSL/HTTPS (Let's Encrypt)
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div class="flex items-center space-x-4 mt-8">
              <button
                onClick={() => setActiveStep(0)}
                class="btn btn-ghost"
              >
                Back to Templates
              </button>
              <button
                onClick={handleDeploy}
                disabled={deploying || !deploymentRequest.project_id || !deploymentRequest.service_name}
                class="btn btn-primary"
              >
                {deploying ? (
                  <>
                    <Clock class="w-4 h-4 animate-spin mr-2" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket class="w-4 h-4 mr-2" />
                    Deploy Application
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-lg dark:shadow-xl text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle class="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Deployment Successful!</h2>
            <p class="text-gray-600 dark:text-gray-300 mb-6">
              Your Spring Boot application is now live and accessible
            </p>
            <div class="flex items-center justify-center space-x-4">
              <Link href="/app/services" class="btn btn-primary">
                <Server class="w-4 h-4 mr-2" />
                View Services
              </Link>
              <Link href="/app/routes" class="btn btn-secondary">
                <Globe class="w-4 h-4 mr-2" />
                View Routes
              </Link>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          isVisible={toastConfig.show}
          onClose={() => setToastConfig({ ...toastConfig, show: false })}
        />
      </div>
    </div>
  )
}