package nginx

import (
	"bytes"
	"context"
	"crypto/sha256"
	"embed"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"text/template"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Embedded template strings
const baseConfigTemplate = `# Auto-generated nginx configuration
upstream backend_default {
    server 127.0.0.1:8080;
}

{{.ServerBlocks}}
`

const serverConfigTemplate = `# Server block for {{.Route.Domain}}
{{- $route := .Route }}
{{- $cert := .Cert }}
upstream {{upstreamName $route.ServiceID $route.Port}} {
    server {{$route.ServiceName}}:{{$route.Port}};
}

server {
    listen 80;
    {{- if $route.TLS}}
    listen 443 ssl http2;
    {{- end}}
    server_name {{$route.Domain}};

    # ACME HTTP-01 challenge location (always present for certificate issuance)
    location ^~ /.well-known/acme-challenge/ {
        root /var/lib/glinr/acme-http01;
        try_files $uri =404;
    }

    {{- if $route.TLS}}
    {{- if $cert}}
    # SSL certificate configuration
    ssl_certificate /etc/nginx/certs/{{$route.Domain}}.crt;
    ssl_certificate_key /etc/nginx/certs/{{$route.Domain}}.key;
    {{- if ne $cert.PEMChain nil}}
    ssl_trusted_certificate /etc/nginx/certs/{{$route.Domain}}.chain.crt;
    {{- end}}
    
    # SSL security configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers for HTTPS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # HTTP to HTTPS redirect for non-ACME requests
    if ($scheme = http) {
        return 301 https://$server_name$request_uri;
    }
    {{- else}}
    # Certificate not found for {{$route.Domain}} - serve 503 for HTTPS requests
    if ($scheme = https) {
        return 503;
    }
    {{- end}}
    {{- end}}

    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $server_name;
    proxy_set_header X-Forwarded-Port $server_port;

    # Proxy configuration
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    proxy_redirect off;

    {{- if $route.Path}}
    location {{$route.Path}} {
        proxy_pass http://{{upstreamName $route.ServiceID $route.Port}};
        {{- if $route.ProxyConfig}}
        # Custom proxy configuration
        # {{$route.ProxyConfig}}
        {{- end}}
    }
    {{- else}}
    location / {
        proxy_pass http://{{upstreamName $route.ServiceID $route.Port}};
        {{- if $route.ProxyConfig}}
        # Custom proxy configuration  
        # {{$route.ProxyConfig}}
        {{- end}}
    }
    {{- end}}
}`

// Generator handles nginx configuration file generation
type Generator struct {
	templateDir string
	outputDir   string
	templates   map[string]*template.Template
}

// NewGenerator creates a new configuration generator
func NewGenerator(templateDir, outputDir string) *Generator {
	return &Generator{
		templateDir: templateDir,
		outputDir:   outputDir,
		templates:   make(map[string]*template.Template),
	}
}

// Initialize loads and parses nginx configuration templates
func (g *Generator) Initialize(ctx context.Context) error {
	log.Info().
		Str("template_dir", g.templateDir).
		Str("output_dir", g.outputDir).
		Msg("initializing nginx configuration generator")

	// Load templates
	templateFiles := []string{"base.conf.tmpl", "server.conf.tmpl"}
	for _, file := range templateFiles {
		templatePath := filepath.Join(g.templateDir, file)
		tmpl, err := template.ParseFiles(templatePath)
		if err != nil {
			log.Warn().
				Str("template", file).
				Err(err).
				Msg("failed to load nginx template (will use defaults)")
			continue
		}
		g.templates[file] = tmpl
		log.Debug().Str("template", file).Msg("loaded nginx template")
	}

	log.Info().Msg("nginx configuration generator initialized")
	return nil
}

// Render generates nginx configuration from routes and certificates
func (g *Generator) Render(input RenderInput) (string, string, error) {
	// Load templates from embedded filesystem
	baseTemplate, err := template.New("base.conf.tmpl").Parse(baseConfigTemplate)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse base template: %w", err)
	}

	serverTemplate, err := template.New("server.conf.tmpl").Funcs(template.FuncMap{
		"upstreamName": UpstreamName,
	}).Parse(serverConfigTemplate)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse server template: %w", err)
	}

	// Group routes by domain for deterministic ordering
	routesByDomain := make(map[string][]store.RouteWithService)
	for _, route := range input.Routes {
		routesByDomain[route.Domain] = append(routesByDomain[route.Domain], route)
	}

	// Sort domains for deterministic output
	domains := make([]string, 0, len(routesByDomain))
	for domain := range routesByDomain {
		domains = append(domains, domain)
	}
	sort.Strings(domains)

	// Generate server blocks
	var serverBlocks []string
	for _, domain := range domains {
		routes := routesByDomain[domain]
		// Sort routes within domain by path for deterministic output
		sort.Slice(routes, func(i, j int) bool {
			pathI := ""
			if routes[i].Path != nil {
				pathI = *routes[i].Path
			}
			pathJ := ""
			if routes[j].Path != nil {
				pathJ = *routes[j].Path
			}
			return pathI < pathJ
		})

		for _, route := range routes {
			var buf bytes.Buffer
			data := struct {
				Route store.RouteWithService
				Cert  *store.EnhancedCertificate
			}{
				Route: route,
			}

			// Find certificate for this route if TLS is enabled
			if route.TLS {
				if cert, exists := input.Certs[route.Domain]; exists {
					data.Cert = &cert
				}
			}

			if err := serverTemplate.Execute(&buf, data); err != nil {
				return "", "", fmt.Errorf("failed to execute server template: %w", err)
			}
			serverBlocks = append(serverBlocks, buf.String())
		}
	}

	// Generate base config with server blocks
	var baseBuf bytes.Buffer
	baseData := struct {
		ServerBlocks string
	}{
		ServerBlocks: strings.Join(serverBlocks, "\n\n"),
	}

	if err := baseTemplate.Execute(&baseBuf, baseData); err != nil {
		return "", "", fmt.Errorf("failed to execute base template: %w", err)
	}

	config := baseBuf.String()

	// Calculate SHA256 hash
	hash := sha256.Sum256([]byte(config))
	hashStr := fmt.Sprintf("%x", hash)

	return config, hashStr, nil
}

// GenerateConfiguration creates nginx configuration files based on routes (legacy)
func (g *Generator) GenerateConfiguration(ctx context.Context, routes []RouteConfig) error {
	log.Info().Int("routes", len(routes)).Msg("generating nginx configuration")

	// TODO: In future phases, generate actual nginx configuration files
	// For now, this is a placeholder to satisfy the scaffolding requirements
	
	log.Info().Msg("nginx configuration generation completed (placeholder)")
	return nil
}

// RenderInput contains data needed for nginx config generation
type RenderInput struct {
	Routes []store.RouteWithService              `json:"routes"`
	Certs  map[string]store.EnhancedCertificate `json:"certs"`
}

// UpstreamName generates a deterministic upstream name for a service
func UpstreamName(serviceID int64, port int) string {
	return fmt.Sprintf("svc_%d_%d", serviceID, port)
}

// RouteConfig represents a route configuration for nginx generation (legacy)
type RouteConfig struct {
	Domain     string
	Path       string
	TargetHost string
	TargetPort int
	TLS        bool
	CertPath   string
	KeyPath    string
}