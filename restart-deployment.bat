@echo off
echo 🔄 Restarting Vendor Management Application...

REM Stop all containers
echo 📦 Stopping all containers...
docker-compose down

REM Rebuild and start services
echo 🔨 Rebuilding and starting services...
docker-compose up --build -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 30 /nobreak > nul

REM Check service health
echo 🏥 Checking service health...
docker-compose ps

REM Test API endpoint
echo 🧪 Testing API endpoint...
curl -f http://localhost/api/health || echo ❌ API health check failed

echo ✅ Deployment restart completed!
echo 🌐 Application should be available at: http://40.67.147.19
echo 📊 API health check: http://40.67.147.19/api/health
pause
