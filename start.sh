#!/bin/bash

# ============================================
# AI Public Health Epidemiology Tracker
# Start Script
# ============================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════╗"
echo "║   AI Public Health Epidemiology Tracker      ║"
echo "║   EpiTracker AI - Starting Services          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo -e "${GREEN}✓ Environment variables loaded${NC}"
else
  echo -e "${RED}✗ .env file not found! Please create it first.${NC}"
  exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-4001}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

# ============================================
# Clean up used ports
# ============================================
echo -e "\n${YELLOW}Cleaning up ports...${NC}"

cleanup_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}  Killing processes on port $port: $pids${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
  echo -e "${GREEN}  ✓ Port $port is free${NC}"
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

# ============================================
# Check PostgreSQL
# ============================================
echo -e "\n${BLUE}Checking PostgreSQL...${NC}"
if command -v pg_isready &> /dev/null; then
  if pg_isready -q; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
  else
    echo -e "${YELLOW}Starting PostgreSQL...${NC}"
    if command -v brew &> /dev/null; then
      brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    fi
    sleep 2
    if pg_isready -q; then
      echo -e "${GREEN}✓ PostgreSQL started${NC}"
    else
      echo -e "${RED}✗ Could not start PostgreSQL. Please start it manually.${NC}"
      exit 1
    fi
  fi
else
  echo -e "${YELLOW}⚠ pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# ============================================
# Create database if not exists
# ============================================
echo -e "\n${BLUE}Setting up database...${NC}"
DB_NAME="epid_tracker"
if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo -e "${GREEN}✓ Database '$DB_NAME' exists${NC}"
else
  echo -e "${YELLOW}Creating database '$DB_NAME'...${NC}"
  createdb $DB_NAME 2>/dev/null || psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
  echo -e "${GREEN}✓ Database created${NC}"
fi

# ============================================
# Install dependencies
# ============================================
echo -e "\n${BLUE}Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

echo -e "\n${BLUE}Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# ============================================
# Seed database
# ============================================
echo -e "\n${BLUE}Seeding database with sample data...${NC}"
cd "$PROJECT_DIR/backend"
node seed.js
echo -e "${GREEN}✓ Database seeded with data for all features${NC}"

# ============================================
# Start services with hot reload
# ============================================
echo -e "\n${PURPLE}Starting services with hot reload...${NC}"

# Start backend with nodemon for hot reload
cd "$PROJECT_DIR/backend"
npx nodemon server.js &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend starting on port $BACKEND_PORT (PID: $BACKEND_PID)${NC}"

# Start frontend with Vite (has built-in HMR)
cd "$PROJECT_DIR/frontend"
npx vite --port $FRONTEND_PORT &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend starting on port $FRONTEND_PORT (PID: $FRONTEND_PID)${NC}"

# ============================================
# Cleanup handler
# ============================================
cleanup() {
  echo -e "\n${YELLOW}Shutting down services...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  cleanup_port $BACKEND_PORT
  cleanup_port $FRONTEND_PORT
  echo -e "${GREEN}✓ All services stopped${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All services are running!                  ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Frontend: http://localhost:$FRONTEND_PORT          ║${NC}"
echo -e "${GREEN}║   Backend:  http://localhost:$BACKEND_PORT          ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Demo Login:                                ║${NC}"
echo -e "${GREEN}║   Email: $DEMO_EMAIL        ║${NC}"
echo -e "${GREEN}║   Password: $DEMO_PASSWORD          ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Press Ctrl+C to stop all services          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"

# Wait for processes
wait
