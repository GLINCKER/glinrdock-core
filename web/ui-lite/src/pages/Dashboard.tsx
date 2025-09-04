import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { 
  HeroSection, 
  MetricsCards, 
  SimpleCharts, 
  RecentActivity, 
  QuickActions 
} from './Dashboard/components'

export function Dashboard({ onPageChange }: { onPageChange?: (page: string) => void }) {
  const { data: systemInfo, loading: systemLoading } = useApiData(() => apiClient.getSystemInfo())
  const { data: systemMetrics, loading: metricsLoading } = useApiData(() => apiClient.getSystemMetrics())
  const { data: projects, loading: projectsLoading } = useApiData(() => apiClient.getProjects())
  const { data: planInfo } = useApiData(() => apiClient.getSystemPlan())

  // Get aggregate counts
  const [totalServices, setTotalServices] = useState(0)
  const [totalRoutes, setTotalRoutes] = useState(0)
  const [recentServices, setRecentServices] = useState<any[]>([])

  // Fetch counts when projects load
  useEffect(() => {
    if (projects && projects.length > 0) {
      // Get all services count
      Promise.all(
        projects.map(project => 
          apiClient.getProjectServices(project.id).catch(() => [])
        )
      ).then(servicesArrays => {
        const allServices = servicesArrays.flat()
        setTotalServices(allServices.length)
        // Get recent services (latest 4)
        const sortedServices = allServices
          .filter(service => service.created_at)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 6) // Show 6 recent services for better layout
        setRecentServices(sortedServices)
      })

      // Get all routes count
      apiClient.getAllRoutes().then(routes => {
        setTotalRoutes(routes?.length || 0)
      }).catch(() => {
        setTotalRoutes(0)
      })
    }
  }, [projects])

  return (
    <div class="space-y-8 fade-in">
      {/* Hero Section */}
      <HeroSection planInfo={planInfo} />

      {/* Key Metrics */}
      <MetricsCards 
        projects={projects}
        totalServices={totalServices}
        totalRoutes={totalRoutes}
        systemInfo={systemInfo}
        onPageChange={onPageChange}
      />

      {/* Resource Performance Charts */}
      <SimpleCharts 
        systemMetrics={systemMetrics}
      />

      {/* Recent Projects & Services Activity */}
      <RecentActivity 
        projects={projects}
        recentServices={recentServices}
        onPageChange={onPageChange}
      />

      {/* Quick Deploy Actions */}
      <QuickActions onPageChange={onPageChange} />
    </div>
  )
}