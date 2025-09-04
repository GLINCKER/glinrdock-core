#!/bin/bash

# Glinrdock Development Startup Script
# Starts both backend and frontend with proper port management

set -e  # Exit on any error

# Configuration
BACKEND_PORT=8080
FRONTEND_PORT=5173
ADMIN_TOKEN=${ADMIN_TOKEN:-"test-token"}
DATA_DIR=${DATA_DIR:-"./dev-data"}
GLINRDOCK_SECRET=${GLINRDOCK_SECRET:-$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-key-32-chars-long-1234")}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Glinrdock Development Startup${NC}"
echo "=================================="

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local name=$2
    echo -e "${YELLOW}🔍 Checking port $port for existing processes...${NC}"
    
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${RED}⚠️  Port $port is occupied by $name process${NC}"
        echo -e "${YELLOW}🔪 Killing processes on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
        
        if lsof -ti:$port >/dev/null 2>&1; then
            echo -e "${RED}❌ Failed to free port $port${NC}"
            exit 1
        else
            echo -e "${GREEN}✅ Port $port freed${NC}"
        fi
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate dependencies
echo -e "\n${BLUE}📋 Validating dependencies...${NC}"

if ! command_exists "go"; then
    echo -e "${RED}❌ Go is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Go found: $(go version | cut -d' ' -f3)${NC}"

if ! command_exists "npm"; then
    echo -e "${RED}❌ Node.js/npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"

# Check if frontend directory exists
if [ ! -d "web/ui-lite" ]; then
    echo -e "${RED}❌ Frontend directory not found at web/ui-lite${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend directory found${NC}"

# Free up ports
kill_port $BACKEND_PORT "backend"
kill_port $FRONTEND_PORT "frontend"

# Create data directory
echo -e "\n${BLUE}📁 Setting up data directory...${NC}"
mkdir -p "$DATA_DIR"
echo -e "${GREEN}✅ Data directory: $DATA_DIR${NC}"

# Install frontend dependencies if needed
echo -e "\n${BLUE}📦 Checking frontend dependencies...${NC}"
cd web/ui-lite
if [ ! -d "node_modules" ] || [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
    echo -e "${YELLOW}🔄 Installing frontend dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies up to date${NC}"
fi
cd ../..

# Start services
echo -e "\n${BLUE}🔥 Starting services...${NC}"

# Start backend in background
echo -e "${YELLOW}🟦 Starting backend on port $BACKEND_PORT...${NC}"
DATA_DIR="$DATA_DIR" HTTP_ADDR=":$BACKEND_PORT" ADMIN_TOKEN="$ADMIN_TOKEN" GLINRDOCK_SECRET="$GLINRDOCK_SECRET" go run ./cmd/glinrdockd &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/v1/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend ready at http://localhost:$BACKEND_PORT${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start within 30 seconds${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Start frontend in background
echo -e "${YELLOW}🟨 Starting frontend on port $FRONTEND_PORT...${NC}"
cd web/ui-lite
VITE_API_BASE_URL=http://localhost:$BACKEND_PORT npm run dev -- --port $FRONTEND_PORT --host &
FRONTEND_PID=$!
cd ../..

# Wait for frontend to be ready
echo -e "${YELLOW}⏳ Waiting for frontend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend ready at http://localhost:$FRONTEND_PORT${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start within 30 seconds${NC}"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Success message
echo -e "\n${GREEN}🎉 Glinrdock development environment ready!${NC}"
echo "============================================="
echo -e "${BLUE}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo -e "${BLUE}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo -e "${BLUE}Admin Token:${NC} $ADMIN_TOKEN"
echo -e "${BLUE}Data Directory:${NC} $DATA_DIR"
echo -e "${BLUE}Encryption Key:${NC} ${GLINRDOCK_SECRET:0:8}... (auto-generated)"
echo ""
echo -e "${YELLOW}📊 Health Check:${NC} curl http://localhost:$BACKEND_PORT/v1/health"
echo -e "${YELLOW}🔑 API Example:${NC} curl -H \"Authorization: Bearer $ADMIN_TOKEN\" http://localhost:$BACKEND_PORT/v1/system"
echo ""
echo -e "${RED}🛑 Press Ctrl+C to stop both services${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Shutting down services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Keep script running
wait