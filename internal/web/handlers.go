package web

import (
	"context"
	"html/template"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/events"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/version"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Store interfaces
type ProjectStore interface {
	ListProjects(ctx context.Context) ([]store.Project, error)
	GetProject(ctx context.Context, id int64) (store.Project, error)
}

type ServiceStore interface {
	ListServices(ctx context.Context, projectID int64) ([]store.Service, error)
	GetService(ctx context.Context, id int64) (store.Service, error)
}

type RouteStore interface {
	ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error)
	GetAllRoutes(ctx context.Context) ([]store.Route, error)
}

// WebHandlers handles web UI requests
type WebHandlers struct {
	templates    *template.Template
	projectStore ProjectStore
	serviceStore ServiceStore
	routeStore   RouteStore
	eventCache   *events.EventCache
}

// PageData represents common page data
type PageData struct {
	Title   string
	Version string
}

// DashboardData represents dashboard page data
type DashboardData struct {
	PageData
	Projects []store.Project
	Services []ServiceWithStatus
	SystemInfo map[string]interface{}
}

// ServiceDetailData represents service detail page data
type ServiceDetailData struct {
	PageData
	Service store.Service
	Status  string
	Routes  []store.Route
}

// ServiceWithStatus combines service with its current status
type ServiceWithStatus struct {
	store.Service
	Status string
}

// NewWebHandlers creates new web handlers
func NewWebHandlers(templateDir string, projectStore ProjectStore, serviceStore ServiceStore, routeStore RouteStore, eventCache *events.EventCache) (*WebHandlers, error) {
	// Load templates
	templatesPattern := filepath.Join(templateDir, "*.html")
	templates, err := template.ParseGlob(templatesPattern)
	if err != nil {
		return nil, err
	}

	return &WebHandlers{
		templates:    templates,
		projectStore: projectStore,
		serviceStore: serviceStore,
		routeStore:   routeStore,
		eventCache:   eventCache,
	}, nil
}

// Dashboard renders the main dashboard
func (w *WebHandlers) Dashboard(c *gin.Context) {
	ctx := context.Background()
	
	// Get projects
	projects, err := w.projectStore.ListProjects(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list projects")
		projects = []store.Project{}
	}

	// Get recent services (limit to 10)
	var services []ServiceWithStatus
	for _, project := range projects {
		projectServices, err := w.serviceStore.ListServices(ctx, project.ID)
		if err != nil {
			log.Error().Err(err).Int64("project_id", project.ID).Msg("failed to list services")
			continue
		}
		
		for _, service := range projectServices {
			status := "unknown"
			if w.eventCache != nil {
				if state, exists := w.eventCache.GetServiceState(service.ID); exists {
					status = state.Status
				}
			}
			
			services = append(services, ServiceWithStatus{
				Service: service,
				Status:  status,
			})
			
			// Limit to 10 recent services
			if len(services) >= 10 {
				break
			}
		}
		if len(services) >= 10 {
			break
		}
	}

	data := DashboardData{
		PageData: PageData{
			Title:   "Dashboard",
			Version: version.Version,
		},
		Projects: projects,
		Services: services,
	}

	if err := w.templates.ExecuteTemplate(c.Writer, "dashboard.html", data); err != nil {
		log.Error().Err(err).Msg("failed to render dashboard")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render page"})
		return
	}
}

// ServiceDetail renders the service detail page
func (w *WebHandlers) ServiceDetail(c *gin.Context) {
	ctx := context.Background()
	
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	service, err := w.serviceStore.GetService(ctx, serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Get service status
	status := "unknown"
	if w.eventCache != nil {
		if state, exists := w.eventCache.GetServiceState(serviceID); exists {
			status = state.Status
		}
	}

	// Get routes
	routes, err := w.routeStore.ListRoutes(ctx, serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to list routes")
		routes = []store.Route{}
	}

	data := ServiceDetailData{
		PageData: PageData{
			Title:   "Service: " + service.Name,
			Version: version.Version,
		},
		Service: service,
		Status:  status,
		Routes:  routes,
	}

	if err := w.templates.ExecuteTemplate(c.Writer, "service_detail.html", data); err != nil {
		log.Error().Err(err).Msg("failed to render service detail")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render page"})
		return
	}
}

// ProjectsList renders the projects list as HTML fragment
func (w *WebHandlers) ProjectsList(c *gin.Context) {
	ctx := context.Background()
	
	projects, err := w.projectStore.ListProjects(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list projects")
		c.String(http.StatusInternalServerError, "Failed to load projects")
		return
	}

	html := ""
	if len(projects) == 0 {
		html = `<div class="empty-state">No projects yet. <a href="/projects/new" hx-target="#modal">Create your first project</a></div>`
	} else {
		for _, project := range projects {
			// Get service count for project
			services, _ := w.serviceStore.ListServices(ctx, project.ID)
			serviceCount := len(services)
			
			html += `<div class="project-card">
				<h4><a href="/projects/` + strconv.FormatInt(project.ID, 10) + `">` + project.Name + `</a></h4>
				<div class="project-meta">` + strconv.Itoa(serviceCount) + ` services • Created ` + project.CreatedAt.Format("Jan 2, 2006") + `</div>
				<div class="project-actions">
					<a href="/projects/` + strconv.FormatInt(project.ID, 10) + `/services/new" hx-target="#modal" class="btn btn-primary">Add Service</a>
				</div>
			</div>`
		}
	}

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, html)
}

// ServicesList renders all services as HTML fragment
func (w *WebHandlers) ServicesList(c *gin.Context) {
	ctx := context.Background()
	
	// Get all projects and their services
	projects, err := w.projectStore.ListProjects(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list projects")
		c.String(http.StatusInternalServerError, "Failed to load services")
		return
	}

	html := ""
	serviceCount := 0
	
	for _, project := range projects {
		services, err := w.serviceStore.ListServices(ctx, project.ID)
		if err != nil {
			continue
		}
		
		for _, service := range services {
			status := "unknown"
			if w.eventCache != nil {
				if state, exists := w.eventCache.GetServiceState(service.ID); exists {
					status = state.Status
				}
			}
			
			html += `<div class="service-card">
				<h4><a href="/services/` + strconv.FormatInt(service.ID, 10) + `">` + service.Name + `</a></h4>
				<div class="service-meta">` + service.Image + ` • Project: ` + project.Name + `</div>
				<div class="service-status ` + status + `">` + status + `</div>
				<div class="service-actions">
					<button hx-post="/api/services/` + strconv.FormatInt(service.ID, 10) + `/start" class="btn btn-success">Start</button>
					<button hx-post="/api/services/` + strconv.FormatInt(service.ID, 10) + `/stop" class="btn btn-warning">Stop</button>
				</div>
			</div>`
			
			serviceCount++
			if serviceCount >= 10 {
				break
			}
		}
		if serviceCount >= 10 {
			break
		}
	}

	if html == "" {
		html = `<div class="empty-state">No services yet. Create a project first, then add services.</div>`
	}

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, html)
}

// SystemStatus renders system status as HTML fragment
func (w *WebHandlers) SystemStatus(c *gin.Context) {
	// Get system info (similar to system endpoint)
	html := `<div class="system-status">
		<div class="status-item">
			<span class="status-label">Docker:</span>
			<span class="status-value connected">Connected</span>
		</div>
		<div class="status-item">
			<span class="status-label">Services:</span>
			<span class="status-value">` + strconv.Itoa(w.getServiceCount()) + ` running</span>
		</div>
		<div class="status-item">
			<span class="status-label">Routes:</span>
			<span class="status-value">` + strconv.Itoa(w.getRouteCount()) + ` configured</span>
		</div>
	</div>`

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, html)
}

// RoutesList renders routes for a service as HTML fragment
func (w *WebHandlers) RoutesList(c *gin.Context) {
	ctx := context.Background()
	
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid service ID")
		return
	}

	routes, err := w.routeStore.ListRoutes(ctx, serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to list routes")
		c.String(http.StatusInternalServerError, "Failed to load routes")
		return
	}

	html := ""
	if len(routes) == 0 {
		html = `<div class="empty-state">No routes configured. <a href="/services/` + strconv.FormatInt(serviceID, 10) + `/routes/new" hx-target="#modal">Add your first route</a></div>`
	} else {
		for _, route := range routes {
			protocol := "http"
			badgeClass := "http"
			if route.TLS {
				protocol = "https"
				badgeClass = "https"
			}
			
			html += `<div class="route-card">
				<div class="route-info">
					<h5>` + route.Domain + `</h5>
					<div class="route-meta">
						<span class="route-badge ` + badgeClass + `">` + protocol + `</span>
						Port: ` + strconv.Itoa(route.Port) + ` • Created ` + route.CreatedAt.Format("Jan 2, 2006") + `
					</div>
				</div>
				<div class="route-actions">
					<button hx-delete="/api/routes/` + strconv.FormatInt(route.ID, 10) + `" 
							hx-target="#routes-list" 
							hx-confirm="Delete route ` + route.Domain + `?"
							class="btn btn-danger">Delete</button>
				</div>
			</div>`
		}
	}

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, html)
}

// Helper methods
func (w *WebHandlers) getServiceCount() int {
	count := 0
	
	if w.eventCache != nil {
		states := w.eventCache.GetAllServiceStates()
		for _, state := range states {
			if state.Status == "running" {
				count++
			}
		}
	}
	
	return count
}

func (w *WebHandlers) getRouteCount() int {
	if w.routeStore == nil {
		return 0
	}
	
	ctx := context.Background()
	
	routes, err := w.routeStore.GetAllRoutes(ctx)
	if err != nil {
		return 0
	}
	
	return len(routes)
}

// SystemOverview renders the system overview page
func (w *WebHandlers) SystemOverview(c *gin.Context) {
	data := struct {
		PageData
		NginxEnabled bool
		LastReload   *time.Time
	}{
		PageData: PageData{
			Title:   "System Overview",
			Version: version.Version,
		},
		NginxEnabled: false, // TODO: Check if nginx is configured
		LastReload:   nil,
	}

	if err := w.templates.ExecuteTemplate(c.Writer, "system.html", data); err != nil {
		log.Error().Err(err).Msg("failed to render system page")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render page"})
		return
	}
}

// AllRoutes renders the routes overview page
func (w *WebHandlers) AllRoutes(c *gin.Context) {
	ctx := context.Background()
	
	routes, err := w.routeStore.GetAllRoutes(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list all routes")
		routes = []store.Route{}
	}

	data := struct {
		PageData
		Routes []store.Route
	}{
		PageData: PageData{
			Title:   "All Routes",
			Version: version.Version,
		},
		Routes: routes,
	}

	if err := w.templates.ExecuteTemplate(c.Writer, "routes.html", data); err != nil {
		log.Error().Err(err).Msg("failed to render routes page")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render page"})
		return
	}
}

// Form handlers

// ShowProjectForm renders the project creation form
func (w *WebHandlers) ShowProjectForm(c *gin.Context) {
	if err := w.templates.ExecuteTemplate(c.Writer, "project_form", nil); err != nil {
		log.Error().Err(err).Msg("failed to render project form")
		c.String(http.StatusInternalServerError, "Failed to render form")
		return
	}
}

// ShowServiceForm renders the service creation form
func (w *WebHandlers) ShowServiceForm(c *gin.Context) {
	projectID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid project ID")
		return
	}

	data := map[string]interface{}{
		"ProjectID": projectID,
	}

	if err := w.templates.ExecuteTemplate(c.Writer, "service_form", data); err != nil {
		log.Error().Err(err).Msg("failed to render service form")
		c.String(http.StatusInternalServerError, "Failed to render form")
		return
	}
}

// ShowRouteForm renders the route creation form
func (w *WebHandlers) ShowRouteForm(c *gin.Context) {
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid service ID")
		return
	}

	data := map[string]interface{}{
		"ServiceID": serviceID,
	}

	if err := w.templates.ExecuteTemplate(c.Writer, "route_form", data); err != nil {
		log.Error().Err(err).Msg("failed to render route form")
		c.String(http.StatusInternalServerError, "Failed to render form")
		return
	}
}