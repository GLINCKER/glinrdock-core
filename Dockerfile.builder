# Multi-stage Docker build for cross-compilation with CGO support
# Handles Linux builds with SQLite support

FROM node:18-alpine AS frontend-builder

# Install dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy frontend source
COPY web/ui-lite/package*.json ./web/ui-lite/
WORKDIR /app/web/ui-lite

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy frontend source
COPY web/ui-lite/ ./

# Build frontend
RUN npm run build

# Go builder stage for Linux
FROM golang:1.24-alpine AS go-builder-linux

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Copy built frontend assets  
COPY --from=frontend-builder /app/web/static ./static

# Build arguments
ARG VERSION=0.1.0-beta
ARG TARGETOS=linux  
ARG TARGETARCH=amd64

# Build binary with CGO support for native architecture
RUN CGO_ENABLED=1 \
    go build \
    -ldflags="-s -w -X 'github.com/GLINCKER/glinrdock/internal/version.Version=${VERSION}' -X 'github.com/GLINCKER/glinrdock/internal/version.Commit=$(git rev-parse --short HEAD 2>/dev/null || echo \"unknown\")' -X 'github.com/GLINCKER/glinrdock/internal/version.BuildTime=$(date -u '+%Y-%m-%d %H:%M:%S UTC')'" \
    -trimpath \
    -buildvcs=false \
    -o bin/glinrdockd \
    ./cmd/glinrdockd

# Final minimal runtime image
FROM alpine:3.18 AS runtime

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite curl

# Create non-root user
RUN addgroup -g 1000 glinrdock && \
    adduser -u 1000 -G glinrdock -D -h /app glinrdock

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=go-builder-linux /app/bin/glinrdockd /usr/local/bin/glinrdockd

# Set permissions
RUN chmod +x /usr/local/bin/glinrdockd

# Create data directory
RUN mkdir -p /app/data && \
    chown -R glinrdock:glinrdock /app

# Switch to non-root user
USER glinrdock

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/v1/health || exit 1

# Set environment variables
ENV DATA_DIR=/app/data
ENV HTTP_ADDR=:8080
ENV GIN_MODE=release

# Start command
ENTRYPOINT ["/usr/local/bin/glinrdockd"]