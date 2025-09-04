#!/bin/bash

# Glinrdock Frontend Development Startup Script
# Starts only the Preact/Vite frontend

set -e  # Exit on any error

# Configuration
FRONTEND_PORT=5173
BACKEND_PORT=8080
BACKEND_URL=${VITE_API_BASE_URL:-"http://localhost:$BACKEND_PORT"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🟨 Glinrdock Frontend Startup${NC}"
echo "==============================="

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    echo -e "${YELLOW}🔍 Checking port $port for existing processes...${NC}"
    
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${RED}⚠️  Port $port is occupied${NC}"
        echo -e "${YELLOW}🔪 Killing processes on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
        
        if lsof -ti:$port >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Port $port freed${NC}"
        else
            echo -e "${RED}❌ Failed to free port $port${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate Node.js/npm installation
echo -e "\n${BLUE}📋 Validating Node.js installation...${NC}"
if ! command_exists "node"; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo -e "${YELLOW}💡 Install Node.js from: https://nodejs.org/${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

if ! command_exists "npm"; then
    echo -e "${RED}❌ npm is not installed${NC}"
    echo -e "${YELLOW}💡 npm should come with Node.js installation${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"

# Check if frontend directory exists
if [ ! -d "web/ui-lite" ]; then
    echo -e "${RED}❌ Frontend directory not found at web/ui-lite${NC}"
    echo -e "${YELLOW}💡 Make sure you're in the glinrdock root directory${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend directory found${NC}"

# Navigate to frontend directory
cd web/ui-lite

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in web/ui-lite${NC}"
    exit 1
fi
echo -e "${GREEN}✅ package.json found${NC}"

# Free up the frontend port
kill_port $FRONTEND_PORT

# Install dependencies if needed
echo -e "\n${BLUE}📦 Checking frontend dependencies...${NC}"
if [ ! -d "node_modules" ] || [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
    echo -e "${YELLOW}🔄 Installing frontend dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies up to date${NC}"
fi

# Check backend connectivity
echo -e "\n${BLUE}🔌 Checking backend connectivity...${NC}"
if curl -s --connect-timeout 3 "$BACKEND_URL/v1/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is accessible at $BACKEND_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not accessible at $BACKEND_URL${NC}"
    echo -e "${YELLOW}💡 Make sure backend is running or start it with: ./dev-backend.sh${NC}"
    echo -e "${BLUE}ℹ️  Frontend will still start but API calls may fail${NC}"
fi

# Configuration info
echo -e "\n${BLUE}🔧 Frontend Configuration:${NC}"
echo -e "${BLUE}Port:${NC} $FRONTEND_PORT"
echo -e "${BLUE}Backend URL:${NC} $BACKEND_URL"
echo -e "${BLUE}Build Tool:${NC} Vite"
echo -e "${BLUE}Framework:${NC} Preact + TypeScript"

# Start frontend
echo -e "\n${YELLOW}🚀 Starting Glinrdock frontend...${NC}"
echo -e "${BLUE}Vite dev server logs will appear below:${NC}"
echo "========================================="

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down frontend...${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Start the frontend dev server
VITE_API_BASE_URL="$BACKEND_URL" npm run dev -- --port $FRONTEND_PORT --host

# This line should never be reached if npm run dev is working properly
echo -e "${RED}❌ Frontend exited unexpectedly${NC}"