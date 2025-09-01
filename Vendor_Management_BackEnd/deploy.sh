#!/bin/bash

# Production Deployment Script for Vendor Management API
# Usage: ./deploy.sh [environment]

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="vendor-management-api"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"

log "Starting deployment for environment: $ENVIRONMENT"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    error "docker-compose is not installed. Please install it and try again."
fi

# Backup current deployment
log "Creating backup of current deployment..."
if [ -d "./uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz" ./uploads
    log "Uploads backup created: uploads_backup_$TIMESTAMP.tar.gz"
fi

if [ -d "./logs" ]; then
    tar -czf "$BACKUP_DIR/logs_backup_$TIMESTAMP.tar.gz" ./logs
    log "Logs backup created: logs_backup_$TIMESTAMP.tar.gz"
fi

# Stop existing containers
log "Stopping existing containers..."
docker-compose down --remove-orphans || warning "Failed to stop existing containers"

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    log "Pulling latest changes from git..."
    git pull origin main || warning "Failed to pull latest changes"
fi

# Build and start services
log "Building and starting services..."
docker-compose build --no-cache || error "Failed to build Docker images"

# Start services
log "Starting services..."
docker-compose up -d || error "Failed to start services"

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 30

# Check service health
log "Checking service health..."
if ! docker-compose ps | grep -q "Up"; then
    error "Services failed to start properly"
fi

# Test API health endpoint
log "Testing API health endpoint..."
for i in {1..10}; do
    if curl -f http://localhost:5001/health > /dev/null 2>&1; then
        log "API is healthy and responding"
        break
    else
        if [ $i -eq 10 ]; then
            error "API health check failed after 10 attempts"
        fi
        log "Waiting for API to be ready... (attempt $i/10)"
        sleep 10
    fi
done

# Run database migrations (if any)
log "Running database migrations..."
# Add your migration commands here if needed
# Example: docker-compose exec api npm run migrate

# Clean up old backups (keep last 5)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t *.tar.gz | tail -n +6 | xargs -r rm
cd - > /dev/null

# Final health check
log "Performing final health check..."
if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    log "Deployment completed successfully!"
    log "API is available at: http://localhost:5001"
    log "Health check: http://localhost:5001/health"
else
    error "Final health check failed"
fi

# Show service status
log "Service status:"
docker-compose ps

log "Deployment completed at $(date)"
