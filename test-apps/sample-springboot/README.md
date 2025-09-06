# Sample Spring Boot Application

This is a test Spring Boot application for validating GLINRDOCK deployment functionality.

## Features

- RESTful API endpoints
- Spring Boot Actuator for monitoring
- H2 in-memory database
- Health checks and metrics
- Production-ready configuration

## Endpoints

- `GET /api/health` - Application health status
- `GET /api/hello` - Simple greeting message  
- `GET /api/info` - Application and runtime information
- `GET /actuator/health` - Spring Boot health endpoint
- `GET /actuator/info` - Spring Boot info endpoint

## Deployment with GLINRDOCK

This application is designed to test GLINRDOCK's Spring Boot deployment workflow:

1. **Auto-Detection**: GLINRDOCK should detect this as a Maven Spring Boot project
2. **Docker Build**: Uses optimized Dockerfile with JVM tuning
3. **Service Deployment**: Creates Docker service with health checks
4. **Nginx Routing**: Automatically configures reverse proxy
5. **SSL/TLS**: Integrates with Let's Encrypt for HTTPS

## Local Testing

```bash
# Build and run locally
mvn spring-boot:run

# Test endpoints
curl http://localhost:8080/api/health
curl http://localhost:8080/api/hello
curl http://localhost:8080/api/info
```

## Production Configuration

The application includes production-ready features:

- JVM optimization for containers
- Health checks and graceful shutdown
- Structured logging
- Memory and performance monitoring
- Security headers via nginx proxy