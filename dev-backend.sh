#!/bin/bash

# Glinrdock Backend Development Startup Script
# Starts only the Go backend server

set -e  # Exit on any error

# Configuration
BACKEND_PORT=8080
ADMIN_TOKEN=${ADMIN_TOKEN:-"test-token"}
DATA_DIR=${DATA_DIR:-"./dev-data"}
GLINRDOCK_SECRET=${GLINRDOCK_SECRET:-$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-key-32-chars-long-1234")}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🟦 Glinrdock Backend Startup${NC}"
echo "=============================="

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

# Validate Go installation
echo -e "\n${BLUE}📋 Validating Go installation...${NC}"
if ! command_exists "go"; then
    echo -e "${RED}❌ Go is not installed${NC}"
    echo -e "${YELLOW}💡 Install Go from: https://golang.org/dl/${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Go found: $(go version | cut -d' ' -f3)${NC}"

# Check if we're in the right directory
if [ ! -f "cmd/glinrdockd/main.go" ]; then
    echo -e "${RED}❌ Backend source not found. Make sure you're in the glinrdock root directory${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backend source found${NC}"

# Free up the backend port
kill_port $BACKEND_PORT

# Create data directory
echo -e "\n${BLUE}📁 Setting up data directory...${NC}"
mkdir -p "$DATA_DIR"
echo -e "${GREEN}✅ Data directory: $DATA_DIR${NC}"

# Build info
echo -e "\n${BLUE}🔧 Build Configuration:${NC}"
echo -e "${BLUE}Port:${NC} $BACKEND_PORT"
echo -e "${BLUE}Data Directory:${NC} $DATA_DIR"
echo -e "${BLUE}Admin Token:${NC} $ADMIN_TOKEN"
echo -e "${BLUE}Encryption Key:${NC} ${GLINRDOCK_SECRET:0:8}... (auto-generated)"

# Start backend
echo -e "\n${YELLOW}🚀 Starting Glinrdock backend...${NC}"
echo -e "${BLUE}Logs will appear below:${NC}"
echo "================================="

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down backend...${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Start the backend with proper environment variables
DATA_DIR="$DATA_DIR" HTTP_ADDR=":$BACKEND_PORT" ADMIN_TOKEN="$ADMIN_TOKEN" GLINRDOCK_SECRET="$GLINRDOCK_SECRET" go run ./cmd/glinrdockd

# This line should never be reached if go run is working properly
echo -e "${RED}❌ Backend exited unexpectedly${NC}"