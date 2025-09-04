# GLINR Docker Management Platform - Networking

GlinrDock provides advanced per-project Docker networking with stable DNS aliases for inter-service communication. This documentation covers how networking works and how to use it effectively.

## Overview

Each project in GlinrDock gets its own isolated Docker network, enabling secure and efficient communication between services within the same project while maintaining isolation from other projects.

### Key Features

- **Per-Project Networks**: Each project gets its own Docker network (`glinr_proj_<projectID>`)
- **Stable DNS Aliases**: Services are accessible via predictable hostnames
- **Network Isolation**: Services in different projects cannot communicate directly
- **Automatic Configuration**: Networks and aliases are set up automatically when services are created

## Network Architecture

### Project Networks

When you create a project, GlinrDock automatically:
1. Generates a unique network name: `glinr_proj_<projectID>`
2. Creates the Docker network when the first service is deployed
3. Labels the network with `owner=glinrdock` for management

### Service Aliases

Each service gets two types of DNS aliases for inter-service communication:

#### 1. Short Alias (Same-Project Access)
- **Format**: `<service-slug>`
- **Usage**: Simple name for services within the same project
- **Example**: `web`, `api`, `database`

#### 2. Long Alias (Full Qualified)
- **Format**: `<service-slug>.<project-slug>.local`
- **Usage**: Full qualified name, useful for documentation and clarity
- **Example**: `web.myapp.local`, `api.backend.local`

### Slug Generation

Service and project names are converted to network-safe slugs:
- Lowercase conversion
- Spaces and special characters become hyphens
- Only `a-z`, `0-9`, and `-` characters allowed
- Example: "My Web App" → "my-web-app"

## Using Service Networking

### Basic Inter-Service Communication

Services within the same project can communicate using their aliases:

```bash
# From one container, reach another service
curl http://api:8080/health
curl http://database:5432

# Full qualified names also work
curl http://api.myproject.local:8080/health
```

### Common Use Cases

#### Web Application + API
```yaml
# Web service connecting to API service
API_BASE_URL: "http://api:3000"
# or
API_BASE_URL: "http://api.myproject.local:3000"
```

#### Application + Database
```yaml
# Database connection from app
DATABASE_URL: "postgres://user:pass@postgres:5432/mydb"
# or
DATABASE_URL: "postgres://user:pass@postgres.myproject.local:5432/mydb"
```

#### Spring Boot + Redis
```properties
# Spring Boot application.properties
spring.redis.host=redis
spring.redis.port=6379

# or with full qualified name
spring.redis.host=redis.backend.local
```

### Environment Variable Configuration

Use service aliases in your environment variables:

```bash
# API service configuration
DATABASE_HOST=postgres
REDIS_URL=redis://redis:6379
MESSAGE_QUEUE=amqp://rabbitmq:5672

# Full names for clarity
DATABASE_HOST=postgres.myproject.local
REDIS_URL=redis://redis.myproject.local:6379
```

## Service Discovery Examples

### Node.js Application

```javascript
// Connect to database service
const dbConfig = {
  host: 'postgres', // or 'postgres.myproject.local'
  port: 5432,
  database: 'myapp'
};

// Connect to Redis cache
const redis = new Redis({
  host: 'redis', // or 'redis.myproject.local'
  port: 6379
});

// Call another microservice
const response = await fetch('http://api:3000/users');
```

### Python Flask Application

```python
import os
import psycopg2
import redis

# Database connection
db_host = os.getenv('DB_HOST', 'postgres')  # or 'postgres.myproject.local'
conn = psycopg2.connect(
    host=db_host,
    port=5432,
    database='myapp'
)

# Redis connection
redis_host = os.getenv('REDIS_HOST', 'redis')  # or 'redis.myproject.local'
r = redis.Redis(host=redis_host, port=6379)

# API calls
import requests
api_response = requests.get('http://api:8080/data')
```

### Spring Boot Application

```properties
# application.properties
spring.datasource.url=jdbc:postgresql://postgres:5432/myapp
spring.redis.host=redis
server.port=8080

# External service calls
external.api.url=http://api:3000
external.auth.url=http://auth:8080
```

```java
// Java service calling another service
@Service
public class UserService {
    @Value("${external.api.url}")
    private String apiUrl; // Will resolve to http://api:3000
    
    public void callExternalApi() {
        RestTemplate restTemplate = new RestTemplate();
        String response = restTemplate.getForObject(apiUrl + "/users", String.class);
    }
}
```

## Network Configuration in UI

### Viewing Network Information

1. Navigate to your service's detail page
2. Click the **"Networking"** tab
3. View service aliases, network name, and connection examples

### Service Aliases Display

The Networking tab shows:
- **Service Aliases**: All available DNS names for the service
- **Project Network**: The Docker network name
- **Connection Examples**: Copy-paste ready commands and URLs
- **Connectivity Testing**: Built-in tools to test service-to-service communication

### Copy-Paste Integration

The UI provides easy copy buttons for:
- Individual service aliases
- Complete connection strings
- Test commands (curl, ping)
- Environment variable formats

## Network Security

### Isolation Benefits

- **Project Isolation**: Services in different projects cannot communicate
- **Network Segmentation**: Each project has its own network namespace
- **Controlled Access**: Only services within the same project can resolve aliases

### Security Best Practices

1. **Use Internal Communication**: Prefer service aliases over public endpoints
2. **Environment Variables**: Store connection details in env vars, not code
3. **Service Authentication**: Implement proper auth between services
4. **Network Policies**: Consider additional Docker network policies if needed

## Troubleshooting

### Common Issues

#### Service Not Reachable
```bash
# Test connectivity from within a container
docker exec -it <container> ping <service-alias>
docker exec -it <container> nslookup <service-alias>

# Example
docker exec -it web-container ping api
```

#### DNS Resolution Problems
1. Ensure both services are in the same project
2. Check if the target service is running
3. Verify the alias spelling and format
4. Use the Networking tab's connectivity testing tool

#### Network Configuration
```bash
# Inspect Docker networks
docker network ls | grep glinr_proj

# Inspect specific network
docker network inspect glinr_proj_<projectID>

# Check container network connections
docker inspect <container> | grep NetworkMode
```

### Debug Commands

```bash
# From within a service container:

# Test DNS resolution
nslookup api
nslookup api.myproject.local

# Test connectivity
curl -v http://api:8080/health
wget --spider http://api:8080

# Check network configuration
ip route
cat /etc/resolv.conf
```

## API Reference

### Network Information Endpoints

#### Get Service Network Details
```bash
GET /api/v1/services/{serviceId}
```

Response includes:
```json
{
  "network": {
    "name": "glinr_proj_1",
    "alias": "web",
    "dns_hint": "web:8080",
    "curl_hint": "curl http://web:8080/health"
  },
  "aliases": [
    "web",
    "web.myproject.local"
  ]
}
```

#### Get Project Network Information
```bash
GET /api/v1/projects/{projectId}
```

Response includes:
```json
{
  "id": 1,
  "name": "My Project",
  "network_name": "glinr_proj_1"
}
```

## Migration Guide

### Updating Existing Services

For services created before the networking feature:

1. **Automatic Migration**: Existing services will be automatically connected to their project network on the next deployment
2. **Environment Updates**: Update your service configurations to use the new aliases
3. **Testing**: Use the Networking tab to test connectivity before updating production configs

### Configuration Changes

Replace hardcoded IPs or manual service discovery with aliases:

```bash
# Before
DATABASE_HOST=172.17.0.2
API_URL=http://172.17.0.3:8080

# After
DATABASE_HOST=postgres
API_URL=http://api:8080
```

This networking system provides a robust foundation for microservice communication while maintaining the simplicity and reliability that developers expect.