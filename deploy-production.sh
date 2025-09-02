#!/bin/bash

# Production Deployment Script for Vendor Management Tool
# This script should be run on your Ubuntu production server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="vendor-management-tool"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

echo -e "${GREEN}🚀 Starting production deployment...${NC}"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${YELLOW}⚠️  Please update the .env file with your production values before continuing.${NC}"
        echo -e "${YELLOW}⚠️  Press Enter when ready to continue...${NC}"
        read
    else
        echo -e "${RED}❌ env.example file not found. Please create a .env file manually.${NC}"
        exit 1
    fi
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f $DOCKER_COMPOSE_FILE down --remove-orphans

# Remove old images
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker system prune -f

# Pull latest images (if using external images)
echo -e "${YELLOW}📥 Pulling latest base images...${NC}"
docker-compose -f $DOCKER_COMPOSE_FILE pull

# Build and start services
echo -e "${YELLOW}🔨 Building and starting services...${NC}"
docker-compose -f $DOCKER_COMPOSE_FILE up -d --build

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 30

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"

# Check PostgreSQL
if docker-compose -f $DOCKER_COMPOSE_FILE ps postgres | grep -q "healthy"; then
    echo -e "${GREEN}✅ PostgreSQL is healthy${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not healthy${NC}"
    docker-compose -f $DOCKER_COMPOSE_FILE logs postgres
    exit 1
fi

# Check API
if docker-compose -f $DOCKER_COMPOSE_FILE ps api | grep -q "healthy"; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API is not healthy${NC}"
    docker-compose -f $DOCKER_COMPOSE_FILE logs api
    exit 1
fi

# Check Frontend
if docker-compose -f $DOCKER_COMPOSE_FILE ps client | grep -q "healthy"; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend is not healthy${NC}"
    docker-compose -f $DOCKER_COMPOSE_FILE logs client
    exit 1
fi

# Show running containers
echo -e "${GREEN}📊 Service Status:${NC}"
docker-compose -f $DOCKER_COMPOSE_FILE ps

# Show resource usage
echo -e "${GREEN}📈 Resource Usage:${NC}"
docker stats --no-stream

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}🔌 API: http://localhost:5001${NC}"
echo -e "${GREEN}🗄️  Database: localhost:5432${NC}"

# Optional: Enable production nginx with SSL
if [ "$1" = "--with-ssl" ]; then
    echo -e "${YELLOW}🔒 Starting production nginx with SSL...${NC}"
    docker-compose -f $DOCKER_COMPOSE_FILE --profile production up -d nginx
    echo -e "${GREEN}🔒 Production nginx started with SSL support${NC}"
    echo -e "${GREEN}🌐 HTTPS: https://localhost${NC}"
fi
