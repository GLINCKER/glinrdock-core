// API Client for GLINR Dock Backend Integration
import { useState, useEffect } from 'preact/hooks'

// Type definitions for API responses
export interface SystemHealth {
  status: string
  timestamp: string
}

export interface SystemInfo {
  arch: string
  docker_status: string
  go_version: string
  os: string
  uptime: string
  nginx_proxy_enabled: boolean
}

export interface SystemMetrics {
  node_id: string
  hostname: string
  platform: PlatformInfo
  uptime: number // nanoseconds
  resources: ResourceUsage
  network: NetworkStats
  performance: PerformanceMetrics
  last_updated: string
}

export interface PerformanceMetrics {
  load_average: [number, number, number] // 1min, 5min, 15min
  active_processes: number
  file_descriptors: {
    used: number
    max: number
  }
}

export interface PlatformInfo {
  os: string
  arch: string
  hostname: string
  go_version: string
  num_cpu: number
}

export interface ResourceUsage {
  cpu: CPUUsage
  memory: MemoryUsage
  disk: DiskUsage
}

export interface CPUUsage {
  used_percent: number
  num_cores: number
}

export interface MemoryUsage {
  total: number
  available: number
  used: number
  used_percent: number
}

export interface DiskUsage {
  total: number
  free: number
  used: number
  used_percent: number
}

export interface NetworkStats {
  bytes_recv: number
  bytes_sent: number
  packets_recv: number
  packets_sent: number
}

export interface HistoricalMetric {
  id: number
  timestamp: string
  cpu_percent: number
  memory_used: number
  memory_total: number
  disk_used: number
  disk_total: number
  network_rx: number
  network_tx: number
}

export interface HistoricalMetricsResponse {
  metrics: HistoricalMetric[]
  count: number
  duration?: string
  limit: number
}

export interface Project {
  id: number
  name: string
  description?: string
  repo_url?: string
  branch?: string
  image_target?: string
  network_name?: string
  created_at: string
  updated_at?: string
  services_count?: number
}

export interface PortMap {
  container: number
  host: number
}

export interface Service {
  id: string
  project_id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping'
  ports?: PortMap[]
  env?: Record<string, string>
  created_at: string
  updated_at: string
  container_id?: string
  health_path?: string
  desired_state: 'running' | 'stopped'
  last_exit_code?: number
  restart_count: number
  crash_looping: boolean
  health_status: 'ok' | 'fail' | 'unknown'
  last_probe_at?: string
  registry_id?: string
}

export interface VolumeMap {
  host: string
  container: string
  ro: boolean
}

export interface EnvVar {
  key: string
  value: string
  is_secret: boolean
}

export interface ServiceConfig {
  id: number
  project_id: number
  name: string
  description?: string
  image: string
  env: EnvVar[]
  ports: PortMap[]
  volumes: VolumeMap[]
}

export interface InternalPortMapping {
  container: number
  protocol?: string
}

export interface ServiceNetwork {
  alias: string
  network: string
  ipv4?: string
  ports_internal: InternalPortMapping[]
  dns_hint: string
  curl_hint: string
}

export interface LinkedService {
  id: number
  alias: string
  project_id: number
  name: string
}

export interface ServiceDetail {
  id: number
  project_id: number
  name: string
  description?: string
  image: string
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'created' | 'paused' | 'unknown'
  created_at: string
  updated_at?: string
  ports: PortMap[]
  volumes?: VolumeMap[]
  health_path?: string
  desired_state: 'running' | 'stopped'
  last_exit_code?: number
  restart_count: number
  crash_looping: boolean
  health_status: 'ok' | 'fail' | 'unknown'
  last_probe_at?: string
  env_summary_count: number
  last_deploy_at?: string
  container_id?: string
  state_reason?: string
  network?: ServiceNetwork
  aliases?: string[]
}

export interface Route {
  id: number
  service_id: number
  domain: string
  path?: string
  port: number
  tls: boolean
  proxy_config?: string
  created_at: string
  updated_at: string
  // Health check fields (optional, populated when available)
  last_check_at?: string
  last_status?: 'OK' | 'FAIL'
}

export interface Certificate {
  id: number
  domain: string
  type: 'manual' | 'letsencrypt' | 'custom'
  has_cert: boolean
  has_key: boolean
  expires_at?: string
  auto_renew: boolean
  created_at: string
  updated_at: string
}

export interface ServiceStats {
  cpu_usage: number
  memory_usage: number
  memory_limit: number
  network_rx: number
  network_tx: number
}

export interface Registry {
  id: string
  name: string
  type: string
  server: string
  username: string
  created_at: string
  updated_at: string
}

export interface RegistryType {
  type: string
  server: string
}

export interface CreateRegistryData {
  name: string
  type: string
  server: string
  username: string
  password: string
}

// Help API Types
export interface HelpManifestEntry {
  slug: string
  title: string
  section: string
  rel_path: string
  tags: string[]
  version: string
  updated_at: string
  word_count: number
  etag: string
}

export interface HelpManifest {
  generated: string
  version: string
  description: string
  files: HelpManifestEntry[]
  stats: {
    total_files: number
    total_words: number
    section_count: Record<string, number>
    audience_count: Record<string, number>
    version_count: Record<string, number>
  }
}

export interface HelpDocument {
  slug: string
  markdown: string
  updated_at: string
  etag?: string
}

// Search API Types
export interface SearchHit {
  id: number
  type: 'project' | 'service' | 'route' | 'setting' | 'registry' | 'env_template' | 'page' | 'help'
  entity_id: number | string
  title: string
  subtitle: string
  url_path: string
  score: number
  project_id?: number
  badges?: SearchBadge[]
  content?: string
}

export interface SearchBadge {
  k: string
  v: string
}

export interface SearchResult {
  hits: SearchHit[]
  took_ms: number
  fts5: boolean
  total?: number
}

export interface SearchCapabilities {
  fts5: boolean
  mode: string
}

export interface SearchSuggestion {
  q: string
  label: string
  type: string
  url_path: string
}

export interface SuggestResult {
  suggestions: SearchSuggestion[]
  took_ms: number
  fts5: boolean
}

export interface APIError {
  error: string
  message?: string
  code?: number
}

export interface QuotaError extends APIError {
  error: 'quota_exceeded'
  limit: number
  plan: string
  upgrade_hint: string
}

export interface PlanInfo {
  plan: string
  limits: {
    MaxTokens: number
    MaxClients: number
    MaxUsers: number
  }
  usage: {
    tokens: number
    clients: number
    users: number
  }
  features: {
    projects: boolean
    services: boolean
    routes: boolean
    logs: boolean
    basic_metrics: boolean
    lockdown: boolean
    emergency_restart: boolean
    smtp_alerts: boolean
    oauth: boolean
    multi_env: boolean
    sso: boolean
    audit_logs: boolean
    ci_integrations: boolean
    advanced_dashboards: boolean
  }
}

export interface Token {
  id: number
  name: string
  role: string
  kind?: string
  created_at: string
  last_used_at?: string
  expires_at?: string
}

export interface Client {
  name: string
  status: string
  last_ip?: string
  last_seen?: string
  requests?: number
}

export interface AuthInfo {
  method: 'session' | 'token'
  token_name?: string
  role?: string
  user?: {
    login: string
    name?: string
    avatar_url?: string
  }
}

// Service Discovery types
export interface DiscoveredService {
  container_id: string
  container_name: string
  image: string
  status: string
  created: string
  project_id?: number
  service_id?: number
  labels: Record<string, string>
  is_orphaned: boolean
  orphan_reason?: string
}

export interface DiscoveryResponse {
  discovered_services: DiscoveredService[]
  total_containers: number
  orphaned_count: number
}

export interface AdoptContainerRequest {
  container_id: string
  project_id: number
  service_name: string
}

export interface AdoptContainerResponse {
  message: string
  service: ServiceDetail
  adoption_notes: string[]
}

export interface CleanupContainerRequest {
  container_id: string
  force?: boolean
}

export interface CleanupContainerResponse {
  message: string
  container_id: string
  container_name: string
  cleanup_notes: string[]
}

export interface ServiceEnvironment {
  service_id: number
  container_id: string
  user_env: Record<string, string>
  system_env: Record<string, string>
}

// Standardized API Error Types
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public requestId?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class AuthError extends APIError {
  constructor(message = 'Authentication required', requestId?: string) {
    super(message, 401, 'AUTH_REQUIRED', requestId)
    this.name = 'AuthError'
  }
}

export class PermissionError extends APIError {
  constructor(message = 'Permission denied', requestId?: string) {
    super(message, 403, 'PERMISSION_DENIED', requestId)
    this.name = 'PermissionError'
  }
}

export class NotFoundError extends APIError {
  constructor(message = 'Resource not found', requestId?: string) {
    super(message, 404, 'NOT_FOUND', requestId)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded', requestId?: string) {
    super(message, 429, 'RATE_LIMIT', requestId)
    this.name = 'RateLimitError'
  }
}

export class ServerError extends APIError {
  constructor(message = 'Internal server error', status = 500, requestId?: string) {
    super(message, status, 'SERVER_ERROR', requestId)
    this.name = 'ServerError'
  }
}

export class NetworkError extends APIError {
  constructor(message = 'Network error', requestId?: string) {
    super(message, 0, 'NETWORK_ERROR', requestId)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends APIError {
  constructor(message = 'Request timeout', requestId?: string) {
    super(message, 0, 'TIMEOUT', requestId)
    this.name = 'TimeoutError'
  }
}

// Request configuration interface
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'
  body?: any
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
}

// Diagnostics interface
interface APIFailureEntry {
  timestamp: string
  requestId: string
  method: string
  url: string
  status?: number
  error: string
  duration: number
}

// API Client Class
class APIClient {
  private baseURL: string
  private token: string | null = null
  private diagnostics: APIFailureEntry[] = []
  private readonly MAX_DIAGNOSTICS = 5

  constructor(baseURL?: string) {
    // Auto-detect development vs production environment
    if (!baseURL) {
      // Use empty string to work with Vite proxy in dev and relative URLs in prod
      baseURL = ''
    }
    this.baseURL = baseURL
    this.token = localStorage.getItem('glinrdock_token')
  }

  // Set authentication token
  setToken(token: string) {
    this.token = token
    localStorage.setItem('glinrdock_token', token)
  }

  // Clear authentication token
  clearToken() {
    this.token = null
    localStorage.removeItem('glinrdock_token')
  }

  // Check if user is authenticated (token or session)
  isAuthenticated(): boolean {
    return !!this.token || this.hasSessionCookie()
  }

  // Check if session cookie exists
  private hasSessionCookie(): boolean {
    return document.cookie.split(';').some(cookie => 
      cookie.trim().startsWith('glinr_session=')
    )
  }

  // Generate unique request ID for debugging
  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  // Add API failure to diagnostics ring buffer
  private addDiagnostic(entry: APIFailureEntry) {
    this.diagnostics.unshift(entry)
    if (this.diagnostics.length > this.MAX_DIAGNOSTICS) {
      this.diagnostics = this.diagnostics.slice(0, this.MAX_DIAGNOSTICS)
    }
  }

  // Get diagnostics data (for debug panel)
  getDiagnostics(): APIFailureEntry[] {
    return [...this.diagnostics]
  }

  // Clear diagnostics
  clearDiagnostics() {
    this.diagnostics = []
  }

  // Centralized request handler with timeout, abort, and error mapping
  async request<T>(path: string, config: RequestConfig = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      signal,
      timeoutMs = 8000,
      headers = {}
    } = config

    const requestId = this.generateRequestId()
    const url = `${this.baseURL}${path.startsWith('/') ? '' : '/'}${path}`
    const startTime = Date.now()

    // Create abort controller for timeout if no signal provided
    const timeoutController = new AbortController()
    const effectiveSignal = signal || timeoutController.signal

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!signal) { // Only timeout if we're managing the signal
        timeoutController.abort()
      }
    }, timeoutMs)

    try {
      // Build request config
      const requestConfig: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
          // Note: X-Request-ID removed due to CORS restrictions
          // 'X-Request-ID': requestId,
          ...headers
        },
        signal: effectiveSignal,
        ...(body && { body: JSON.stringify(body) })
      }

      const response = await fetch(url, requestConfig)
      clearTimeout(timeoutId)

      // Handle different status codes with diagnostics tracking
      if (response.status === 401) {
        this.clearToken()
        const error = new AuthError(
          await this.extractErrorMessage(response) || 'Authentication required',
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

      if (response.status === 403) {
        const error = new PermissionError(
          await this.extractErrorMessage(response) || 'Permission denied',
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

      if (response.status === 404) {
        const error = new NotFoundError(
          await this.extractErrorMessage(response) || 'Resource not found',
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

      if (response.status === 429) {
        const error = new RateLimitError(
          await this.extractErrorMessage(response) || 'Rate limit exceeded',
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

      if (response.status >= 500) {
        const error = new ServerError(
          await this.extractErrorMessage(response) || 'Internal server error',
          response.status,
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

      if (!response.ok) {
        const error = new APIError(
          await this.extractErrorMessage(response) || `HTTP ${response.status}`,
          response.status,
          'API_ERROR',
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

      // Handle empty responses
      if (response.status === 204 || method === 'DELETE') {
        return undefined as unknown as T
      }

      // Parse JSON response with error handling
      try {
        return await response.json()
      } catch (parseError) {
        const error = new ServerError(
          `Invalid JSON response (Request ID: ${requestId})`,
          response.status,
          requestId
        )
        this.addDiagnostic({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          url,
          status: response.status,
          error: error.message,
          duration: Date.now() - startTime
        })
        throw error
      }

    } catch (error) {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      
      let finalError: APIError
      
      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        finalError = new TimeoutError(`Request timeout after ${timeoutMs}ms`, requestId)
      }
      // Handle network errors
      else if (error instanceof TypeError && error.message.includes('fetch')) {
        finalError = new NetworkError(`Network error: ${error.message}`, requestId)
      }
      // Re-throw our own errors
      else if (error instanceof APIError) {
        finalError = error
      }
      // Wrap unknown errors
      else {
        finalError = new NetworkError(
          `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`,
          requestId
        )
      }
      
      // Add to diagnostics
      this.addDiagnostic({
        timestamp: new Date().toISOString(),
        requestId,
        method,
        url,
        status: finalError instanceof ServerError ? finalError.status : undefined,
        error: finalError.message,
        duration
      })
      
      throw finalError
    }
  }

  // Extract error message from response body
  private async extractErrorMessage(response: Response): Promise<string | null> {
    try {
      const text = await response.text()
      if (!text) return null

      const data = JSON.parse(text)
      return data.error || data.message || null
    } catch {
      return null
    }
  }

  // HTTP method helpers using the centralized request method
  async get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(`/v1${endpoint}`, { method: 'GET', signal })
  }

  async post<T>(endpoint: string, data?: any, signal?: AbortSignal): Promise<T> {
    return this.request<T>(`/v1${endpoint}`, {
      method: 'POST',
      body: data,
      signal
    })
  }

  async put<T>(endpoint: string, data?: any, signal?: AbortSignal): Promise<T> {
    return this.request<T>(`/v1${endpoint}`, {
      method: 'PUT',
      body: data,
      signal
    })
  }

  async delete<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(`/v1${endpoint}`, { method: 'DELETE', signal })
  }

  // API Endpoints

  // Health & System
  async getHealth(): Promise<SystemHealth> {
    return this.get<SystemHealth>('/health')
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return this.get<SystemInfo>('/system')
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    return this.get<SystemMetrics>('/system/metrics')
  }

  // Historical metrics
  async getHistoricalMetrics(duration: string = '24h', limit: number = 50): Promise<HistoricalMetricsResponse> {
    return this.get<HistoricalMetricsResponse>(`/metrics/historical?duration=${duration}&limit=${limit}`)
  }

  async getLatestHistoricalMetrics(limit: number = 50, duration?: string): Promise<HistoricalMetricsResponse> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (duration) {
      params.append('duration', duration)
    }
    return this.get<HistoricalMetricsResponse>(`/metrics/latest?${params.toString()}`)
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await this.get<{projects: Project[]}>('/projects')
    return response.projects || []
  }

  async getProject(id: string): Promise<Project> {
    return this.get<Project>(`/projects/${id}`)
  }

  async createProject(data: { name: string; description?: string }): Promise<Project> {
    return this.post<Project>('/projects', data)
  }

  async deleteProject(id: string): Promise<void> {
    return this.delete<void>(`/projects/${id}`)
  }

  // Services
  async getProjectServices(projectId: string | number): Promise<Service[]> {
    const response = await this.get<{services: Service[] | null}>(`/projects/${projectId}/services`)
    return response.services || []
  }

  async getService(id: string): Promise<ServiceDetail> {
    return this.get<ServiceDetail>(`/services/${id}`)
  }

  async createService(projectId: string, data: {
    name: string
    image: string
    ports?: PortMap[]
    env?: Record<string, string>
    registry_id?: string
  }): Promise<Service> {
    return this.post<Service>(`/projects/${projectId}/services`, data)
  }

  async deleteService(id: string): Promise<void> {
    return this.delete<void>(`/services/${id}`)
  }

  async startService(id: string): Promise<void> {
    return this.post<void>(`/services/${id}/start`)
  }

  async stopService(id: string): Promise<void> {
    return this.post<void>(`/services/${id}/stop`)
  }

  async restartService(id: string): Promise<void> {
    return this.post<void>(`/services/${id}/restart`)
  }

  async unlockService(id: string): Promise<void> {
    return this.post<void>(`/services/${id}/unlock`)
  }

  async runHealthCheck(id: string): Promise<{
    message: string
    service_id: number
    health_status: 'ok' | 'fail' | 'unknown'
    last_probe_at: string
  }> {
    return this.post<{
      message: string
      service_id: number
      health_status: 'ok' | 'fail' | 'unknown'
      last_probe_at: string
    }>(`/services/${id}/health-check/run`)
  }

  async getServiceStats(id: string): Promise<ServiceStats> {
    return this.get<ServiceStats>(`/services/${id}/stats`)
  }

  async getServiceLogs(id: string, lines = 50): Promise<{
    service_id: number
    container: string
    tail_lines: number
    total_lines: number
    logs: string[]
  }> {
    return this.get(`/services/${id}/logs/tail?tail=${lines}`)
  }

  async getServiceConfig(id: string): Promise<ServiceConfig> {
    return this.get<ServiceConfig>(`/services/${id}/config`)
  }

  async updateServiceConfig(id: string, data: {
    name: string
    description?: string
    image: string
    env: EnvVar[]
    ports: PortMap[]
    volumes: VolumeMap[]
  }): Promise<{
    message: string
    container_recreated?: boolean
    warning?: string
    recommendation?: string
  }> {
    return this.put<{
      message: string
      container_recreated?: boolean
      warning?: string
      recommendation?: string
    }>(`/services/${id}/config`, data)
  }

  async getServiceEnvironment(id: string): Promise<ServiceEnvironment> {
    return this.get<ServiceEnvironment>(`/services/${id}/environment`)
  }

  async getServiceNetwork(id: string): Promise<ServiceNetwork> {
    return this.get<ServiceNetwork>(`/services/${id}/network`)
  }

  async getServiceLinks(id: string): Promise<LinkedService[]> {
    return this.get<LinkedService[]>(`/services/${id}/links`)
  }

  async updateServiceLinks(id: string, targets: number[]): Promise<{ message: string, links: LinkedService[] }> {
    return this.post<{ message: string, links: LinkedService[] }>(`/services/${id}/links`, { targets })
  }

  // Service Discovery
  async discoverServices(all?: boolean): Promise<DiscoveryResponse> {
    const params = all ? '?all=true' : ''
    return this.get<DiscoveryResponse>(`/services/discover${params}`)
  }

  // Container Adoption
  async adoptContainer(request: AdoptContainerRequest): Promise<AdoptContainerResponse> {
    return this.post<AdoptContainerResponse>('/services/adopt', request)
  }

  // Container Cleanup
  async cleanupContainer(request: CleanupContainerRequest): Promise<CleanupContainerResponse> {
    return this.post<CleanupContainerResponse>('/services/cleanup', request)
  }

  // Routes
  async listRoutes(): Promise<Route[]> {
    const response = await this.get<{routes: Route[] | null}>('/routes')
    return response.routes || []
  }

  async listServiceRoutes(serviceId: string): Promise<Route[]> {
    const response = await this.get<{routes: Route[] | null}>(`/services/${serviceId}/routes`)
    return response.routes || []
  }

  async getProjectRoutes(projectId: string): Promise<Route[]> {
    const response = await this.get<{routes: Route[] | null}>(`/projects/${projectId}/routes`)
    return response.routes || []
  }

  async createRoute(serviceId: string, data: {
    domain: string
    path?: string
    port: number
    tls?: boolean
  }): Promise<Route> {
    const result = await this.post<Route>(`/services/${serviceId}/routes`, data)
    
    // Log audit event
    this.logAuditEvent('route.create', {
      action: 'route_created',
      service_id: serviceId,
      domain: data.domain,
      path: data.path || '/',
      port: data.port,
      tls: data.tls || false,
      route_id: result.id,
      timestamp: new Date().toISOString()
    }).catch(console.warn)
    
    return result
  }

  async deleteRoute(id: string): Promise<void> {
    // Log audit event before deletion (we won't have route details after)
    this.logAuditEvent('route.delete', {
      action: 'route_deleted',
      route_id: id,
      timestamp: new Date().toISOString()
    }).catch(console.warn)
    
    return this.delete<void>(`/routes/${id}`)
  }
  
  async updateRoute(id: string, data: {
    domain: string
    path?: string
    port: number
    tls: boolean
    proxy_config?: string
  }): Promise<Route> {
    const result = await this.put<Route>(`/routes/${id}`, data)
    
    // Log audit event
    this.logAuditEvent('route.update', {
      action: 'route_updated',
      route_id: id,
      domain: data.domain,
      tls: data.tls,
      timestamp: new Date().toISOString()
    }).catch(console.warn)
    
    return result
  }
  
  async previewRouteNginxConfig(id: string): Promise<{config: string}> {
    return this.get<{config: string}>(`/routes/${id}/config`)
  }
  
  // Certificate API methods
  async listCertificates(): Promise<Certificate[]> {
    const response = await this.get<{certificates: Certificate[] | null}>('/certificates')
    return response.certificates || []
  }
  
  async uploadCertificate(data: {
    domain: string
    type: 'manual' | 'letsencrypt' | 'custom'
    cert_data: string
    key_data: string
    auto_renew: boolean
  }): Promise<Certificate> {
    return this.post<Certificate>('/certificates', data)
  }
  
  async deleteCertificate(id: number): Promise<void> {
    return this.delete<void>(`/certificates/${id}`)
  }

  async checkRouteHealth(id: string): Promise<{ status: 'OK' | 'FAIL', checked_at: string }> {
    try {
      const response = await fetch(`${this.baseURL}/v1/routes/${id}/check`, {
        method: 'HEAD',
        headers: {
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
        },
        signal: AbortSignal.timeout(1000), // 1 second timeout
      })

      const status = response.ok ? 'OK' : 'FAIL'
      const checked_at = new Date().toISOString()

      return { status, checked_at }
    } catch (error) {
      // Network errors, timeouts, etc. are treated as FAIL
      return { status: 'FAIL', checked_at: new Date().toISOString() }
    }
  }

  async nginxReload(): Promise<{ message: string }> {
    const result = await this.post<{ message: string }>('/system/nginx/reload')
    
    // Log audit event
    this.logAuditEvent('nginx.reload', { 
      action: 'nginx_configuration_reload',
      timestamp: new Date().toISOString()
    }).catch(console.warn) // Don't block on audit logging failures
    
    return result
  }

  async nginxValidate(): Promise<{ message: string, valid: boolean }> {
    const result = await this.post<{ message: string, valid: boolean }>('/system/nginx/validate')
    
    // Log audit event
    this.logAuditEvent('nginx.validate', { 
      action: 'nginx_configuration_validate',
      valid: result.valid,
      timestamp: new Date().toISOString()
    }).catch(console.warn)
    
    return result
  }

  async getNginxConfig(): Promise<{ config: string }> {
    return this.get<{ config: string }>('/system/nginx/config')
  }

  async getNginxStatus(): Promise<{ enabled: boolean, last_apply_hash?: string, last_apply_time?: string }> {
    return this.get<{ enabled: boolean, last_apply_hash?: string, last_apply_time?: string }>('/system/nginx/status')
  }

  // Legacy methods for compatibility
  async getAllRoutes(): Promise<Route[]> {
    return this.listRoutes()
  }

  // Metrics
  async getMetrics(): Promise<any> {
    return this.get<any>('/metrics')
  }

  // System Administration
  async systemLockdown(reason: string): Promise<any> {
    return this.post<any>('/system/lockdown', { reason })
  }

  async liftLockdown(): Promise<any> {
    return this.post<any>('/system/lift-lockdown')
  }

  async getLockdownStatus(): Promise<any> {
    return this.get<any>('/system/lockdown-status')
  }

  async getSystemStatus(): Promise<any> {
    return this.get<any>('/system/status')
  }

  async emergencyRestart(): Promise<any> {
    return this.post<any>('/system/emergency-restart')
  }

  async getSystemLogs(path: string = 'system', lines: number = 50): Promise<any> {
    return this.get<any>(`/system/logs?path=${path}&lines=${lines}`)
  }

  async getLogPaths(): Promise<any> {
    return this.get<any>('/system/log-paths')
  }

  // Backup & Restore
  async createBackup(): Promise<Blob> {
    const url = `${this.baseURL}/v1/system/backup`
    const config: RequestInit = {
      method: 'POST',
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken()
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        throw new Error('Authentication failed')
      }
      throw new Error(`Failed to create backup: ${response.status}`)
    }

    return response.blob()
  }

  async restoreBackup(file: File): Promise<{ message: string; status: string }> {
    const formData = new FormData()
    formData.append('backup', file)

    const url = `${this.baseURL}/v1/system/restore`
    const config: RequestInit = {
      method: 'POST',
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      body: formData
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken()
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        throw new Error('Authentication failed')
      }
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to restore backup: ${response.status}`)
    }

    return response.json()
  }

  // Plan & Quota Management
  async getSystemPlan(): Promise<PlanInfo> {
    return this.get<PlanInfo>('/system/plan')
  }

  // Search API
  async search(query: string, options?: {
    type?: 'project' | 'service' | 'route' | 'setting' | 'registry' | 'env_template' | 'page'
    projectId?: number
    limit?: number
    offset?: number
  }): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query })
    
    if (options?.type) params.append('type', options.type)
    if (options?.projectId) params.append('project_id', options.projectId.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    
    return this.get<SearchResult>(`/search?${params.toString()}`)
  }

  async suggest(query: string, options?: {
    type?: 'project' | 'service' | 'route' | 'setting' | 'registry' | 'env_template' | 'page'
    projectId?: number
    limit?: number
  }): Promise<SuggestResult> {
    const params = new URLSearchParams({ q: query })
    
    if (options?.type) params.append('type', options.type)
    if (options?.projectId) params.append('project_id', options.projectId.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    
    return this.get<SuggestResult>(`/search/suggest?${params.toString()}`)
  }

  async getSearchStatus(): Promise<SearchCapabilities> {
    return this.get<SearchCapabilities>('/search/status')
  }

  // Tokens Management
  async getTokens(): Promise<Token[]> {
    const response = await this.get<{tokens: Token[]}>('/tokens')
    return response.tokens || []
  }

  async createToken(data: { name: string; role: string; kind?: string }): Promise<Token> {
    return this.post<Token>('/tokens', data)
  }

  async deleteToken(name: string): Promise<void> {
    return this.delete<void>(`/tokens/${name}`)
  }

  // Clients Management
  async getClients(): Promise<Client[]> {
    const response = await this.get<{clients: Client[]}>('/clients')
    return response.clients || []
  }

  async touchClient(data: { name: string; ip?: string }): Promise<void> {
    return this.post<void>('/clients/touch', data)
  }

  // Authentication
  async getAuthInfo(): Promise<AuthInfo | null> {
    try {
      const response = await this.get<any>('/auth/me')
      if (!response.authenticated) {
        return null
      }
      
      // Transform response to match AuthInfo interface
      return {
        token_name: response.user?.login || 'unknown',
        role: response.user?.role || 'viewer',
        method: response.auth_method || 'token',
        user: response.auth_method === 'session' && response.user ? {
          login: response.user.login,
          name: response.user.name,
          avatar_url: response.user.avatar_url
        } : undefined
      }
    } catch (error) {
      // If /auth/me fails, we're not authenticated
      return null
    }
  }

  // License Management
  async getLicense(): Promise<any> {
    return this.get<any>('/system/license')
  }

  async activateLicense(licenseBase64: string): Promise<any> {
    return this.post<any>('/system/license/activate', { license_base64: licenseBase64 })
  }

  async deactivateLicense(): Promise<any> {
    return this.post<any>('/system/license/deactivate')
  }

  async downloadSupportBundle(): Promise<Blob> {
    const url = `${this.baseURL}/v1/support/bundle`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    })

    if (!response.ok) {
      throw new Error('Failed to download support bundle')
    }

    return response.blob()
  }

  // Audit event logging
  async logAuditEvent(eventType: string, data: Record<string, any>): Promise<void> {
    try {
      await this.post('/system/audit', {
        event_type: eventType,
        data,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
      })
    } catch (error) {
      // Audit logging failures should not interrupt user operations
      console.warn('Failed to log audit event:', error)
    }
  }

  // Docker Hub proxy methods to avoid CORS issues
  async dockerHubSearch(query: string, pageSize: number = 25): Promise<any> {
    const result = await this.get(`/dockerhub/search?query=${encodeURIComponent(query)}&page_size=${pageSize}`)
    return result
  }

  async dockerHubRepository(imageName: string): Promise<any> {
    return this.get(`/dockerhub/repo/${imageName}`)
  }

  async dockerHubTags(imageName: string, pageSize: number = 10): Promise<any> {
    return this.get(`/dockerhub/tags/${imageName}?page_size=${pageSize}`)
  }

  // Registry methods
  async getRegistries(): Promise<{ registries: Registry[] }> {
    return this.get('/registries')
  }

  async getRegistryTypes(): Promise<{ types: RegistryType[] }> {
    return this.get('/registries/types')
  }

  async createRegistry(data: CreateRegistryData): Promise<Registry> {
    return this.post('/registries', data)
  }

  async deleteRegistry(registryId: string): Promise<void> {
    return this.delete(`/registries/${registryId}`)
  }

  async testRegistryConnection(registryId: string): Promise<{ status: string; message: string }> {
    return this.post(`/registries/${registryId}/test`, {})
  }

  // Help system API
  async getHelpManifest(): Promise<HelpManifest> {
    return this.get<HelpManifest>('/help/manifest')
  }

  async getHelpDocument(slug: string): Promise<HelpDocument> {
    const response = await fetch(`${this.baseURL}/v1/help/${slug}`, {
      method: 'GET',
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError(`Help document '${slug}' not found`)
      }
      throw new APIError(`Failed to fetch help document: ${response.status}`, response.status, 'HELP_ERROR')
    }

    const markdown = await response.text()
    const etag = response.headers.get('ETag') || undefined

    return {
      slug,
      markdown,
      updated_at: new Date().toISOString(),
      etag
    }
  }

  async reindexHelp(): Promise<{ message: string }> {
    return this.post<{ message: string }>('/search/reindex?help=true')
  }
}

// Create singleton instance
export const apiClient = new APIClient()

// Custom hooks for React-like data fetching
export const useApiData = <T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetcher()
      setData(result)
    } catch (err) {
      console.error('API error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // Use useEffect for side effects in Preact
  useEffect(() => {
    fetchData()
  }, dependencies)

  return { data, loading, error, refetch: fetchData }
}

// Utility function to check if error is a quota error
export const isQuotaError = (error: any): error is Error & QuotaError => {
  return error && error.error === 'quota_exceeded' && 'limit' in error && 'plan' in error
}

// Utility function to handle API errors with user feedback
export const handleApiError = (error: Error, context?: string) => {
  const message = context ? `${context}: ${error.message}` : error.message
  console.error('API Error:', message)
  
  // TODO: Replace with proper toast notification system
  if (typeof window !== 'undefined') {
    // For now, use simple alert - will be replaced with toast component
    setTimeout(() => alert(message), 0)
  }
  
  return message
}