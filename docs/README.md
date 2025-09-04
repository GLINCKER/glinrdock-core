# GLINRDOCK Documentation

Welcome to the GLINRDOCK documentation. This internal documentation system provides comprehensive information about installation, configuration, API reference, and operational guidance.

## Table of Contents

### Getting Started
- [Installation Guide](./guides/INSTALL.md) - System requirements and installation steps
- [Quick Start Guide](./guides/QUICKSTART_SPRING.md) - Deploy your first Spring Boot application

### Guides
- [GitHub OAuth Setup](./guides/SETUP_GITHUB_OAUTH.md) - Configure GitHub OAuth integration
- [Spring Boot Deployment](./guides/QUICKSTART_SPRING.md) - Comprehensive Spring Boot deployment guide

### API Reference
- [API Documentation](./reference/API.md) - Complete REST API reference
- [Database Schema](./reference/DB_SCHEMA.md) - Database structure and relationships
- [Security Model](./reference/SECURITY.md) - Security features and best practices
- [RBAC System](./reference/RBAC.md) - Role-based access control
- [Metrics & Monitoring](./reference/METRICS.md) - Metrics endpoints and monitoring
- [Networking](./reference/NETWORKING.md) - Network configuration and routing
- [Certificate Management](./reference/CERTS.md) - TLS certificate automation
- [Secrets API](./reference/SECRETS_API.md) - Encrypted environment variables

### Core Concepts
- [Architecture Overview](./concepts/ARCHITECTURE.md) - System design and components
- [System Context](./concepts/CONTEXT.md) - Environmental considerations
- [Threat Model](./concepts/THREAT_MODEL.md) - Security threat analysis
- [Governance](./concepts/GOVERNANCE.md) - Project governance and decisions

### Operations & Maintenance
- [Release Process](./operations/RELEASING.md) - How to create releases
- [Release Notes](./operations/RELEASE.md) - Version history and changes
- [Resource Monitoring](./operations/RESOURCE_MONITORING.md) - System resource tracking
- [Testing Guide](./operations/TESTING.md) - Testing procedures and guidelines
- [Code Quality](./operations/CODE_QUALITY.md) - Coding standards and practices
- [Security Checklist](./operations/SECURITY_CHECKLIST.md) - Security review checklist
- [Audit Checklist](./operations/AUDIT_CHECKLIST.md) - System audit procedures

### User Interface
- [UI-Lite Documentation](./ui/UI-LITE.md) - Frontend architecture and components
- [Integration Plan](./ui/UI_LITE_INTEGRATION_PLAN.md) - UI integration roadmap

### Planning & Development
- [Development Plans](./plans/PLANS.md) - Future development roadmap
- [Phase Tracker](./plans/PHASE_TRACKER.md) - Development phase tracking
- [Search Plan](./plans/SEARCH_PLAN.md) - Search feature development
- [Enhanced Config Design](./plans/ENHANCED_CONFIG_DESIGN.md) - Configuration system improvements
- [Config Management Roadmap](./plans/CONFIG_MANAGEMENT_ROADMAP.md) - Configuration management plans

### Archive
- [Deprecated Documentation](./_archive/) - Superseded or outdated documentation

## Documentation Standards

This documentation follows these conventions:
- All files use `.md` extension for Markdown format
- Cross-references use relative paths from the current file location
- Code examples include language specification for syntax highlighting
- API examples show both request and response formats
- All sensitive information is redacted or uses example values

## Contributing

When adding or updating documentation:
1. Place files in the appropriate category folder
2. Update this README.md table of contents if adding new files
3. Use clear, concise language without unnecessary formatting
4. Include practical examples and code samples
5. Cross-reference related documentation when helpful

## Search Integration

This documentation is integrated with GLINRDOCK's search system:
- All documentation is indexed and searchable through the command palette
- Use the search operators `type:page` to filter documentation results
- Documentation appears in search results alongside services, projects, and routes

For community support and public release information, visit the [glinrdock-release](https://github.com/GLINCKER/glinrdock-release) repository.