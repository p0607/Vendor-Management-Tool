#!/bin/bash

echo "🔄 Restarting Vendor Management Application..."

# Stop all containers
echo "📦 Stopping all containers..."
docker-compose down

# Remove old containers and images (optional - uncomment if needed)
# echo "🗑️ Removing old containers and images..."
# docker-compose down --rmi all --volumes --remove-orphans

# Rebuild and start services
echo "🔨 Rebuilding and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

# Test API endpoint
echo "🧪 Testing API endpoint..."
curl -f http://localhost/api/health || echo "❌ API health check failed"

echo "✅ Deployment restart completed!"
echo "🌐 Application should be available at: http://40.67.147.19"
echo "📊 API health check: http://40.67.147.19/api/health"
