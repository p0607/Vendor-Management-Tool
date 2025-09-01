@echo off
setlocal enabledelayedexpansion

REM Production Deployment Script for Vendor Management API (Windows)
REM Usage: deploy.bat [environment]

set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=production

set APP_NAME=vendor-management-api
set BACKUP_DIR=.\backups
set LOG_FILE=.\logs\deploy.log
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Create necessary directories
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist ".\logs" mkdir ".\logs"

echo [%date% %time%] Starting deployment for environment: %ENVIRONMENT% | tee -a "%LOG_FILE%"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: Docker is not running. Please start Docker and try again. | tee -a "%LOG_FILE%"
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: docker-compose is not installed. Please install it and try again. | tee -a "%LOG_FILE%"
    exit /b 1
)

REM Backup current deployment
echo [%date% %time%] Creating backup of current deployment... | tee -a "%LOG_FILE%"
if exist ".\uploads" (
    powershell -Command "Compress-Archive -Path '.\uploads\*' -DestinationPath '%BACKUP_DIR%\uploads_backup_%TIMESTAMP%.zip' -Force"
    echo [%date% %time%] Uploads backup created: uploads_backup_%TIMESTAMP%.zip | tee -a "%LOG_FILE%"
)

if exist ".\logs" (
    powershell -Command "Compress-Archive -Path '.\logs\*' -DestinationPath '%BACKUP_DIR%\logs_backup_%TIMESTAMP%.zip' -Force"
    echo [%date% %time%] Logs backup created: logs_backup_%TIMESTAMP%.zip | tee -a "%LOG_FILE%"
)

REM Stop existing containers
echo [%date% %time%] Stopping existing containers... | tee -a "%LOG_FILE%"
docker-compose down --remove-orphans
if errorlevel 1 (
    echo [%date% %time%] WARNING: Failed to stop existing containers | tee -a "%LOG_FILE%"
)

REM Pull latest changes (if using git)
if exist ".git" (
    echo [%date% %time%] Pulling latest changes from git... | tee -a "%LOG_FILE%"
    git pull origin main
    if errorlevel 1 (
        echo [%date% %time%] WARNING: Failed to pull latest changes | tee -a "%LOG_FILE%"
    )
)

REM Build and start services
echo [%date% %time%] Building and starting services... | tee -a "%LOG_FILE%"
docker-compose build --no-cache
if errorlevel 1 (
    echo [%date% %time%] ERROR: Failed to build Docker images | tee -a "%LOG_FILE%"
    exit /b 1
)

REM Start services
echo [%date% %time%] Starting services... | tee -a "%LOG_FILE%"
docker-compose up -d
if errorlevel 1 (
    echo [%date% %time%] ERROR: Failed to start services | tee -a "%LOG_FILE%"
    exit /b 1
)

REM Wait for services to be healthy
echo [%date% %time%] Waiting for services to be healthy... | tee -a "%LOG_FILE%"
timeout /t 30 /nobreak >nul

REM Check service health
echo [%date% %time%] Checking service health... | tee -a "%LOG_FILE%"
docker-compose ps | findstr "Up" >nul
if errorlevel 1 (
    echo [%date% %time%] ERROR: Services failed to start properly | tee -a "%LOG_FILE%"
    exit /b 1
)

REM Test API health endpoint
echo [%date% %time%] Testing API health endpoint... | tee -a "%LOG_FILE%"
for /l %%i in (1,1,10) do (
    curl -f http://localhost:5001/health >nul 2>&1
    if not errorlevel 1 (
        echo [%date% %time%] API is healthy and responding | tee -a "%LOG_FILE%"
        goto :health_check_passed
    )
    if %%i==10 (
        echo [%date% %time%] ERROR: API health check failed after 10 attempts | tee -a "%LOG_FILE%"
        exit /b 1
    )
    echo [%date% %time%] Waiting for API to be ready... (attempt %%i/10) | tee -a "%LOG_FILE%"
    timeout /t 10 /nobreak >nul
)

:health_check_passed

REM Clean up old backups (keep last 5)
echo [%date% %time%] Cleaning up old backups... | tee -a "%LOG_FILE%"
cd "%BACKUP_DIR%"
for /f "skip=5 delims=" %%i in ('dir /b /o-d *.zip 2^>nul') do del "%%i" 2>nul
cd ..

REM Final health check
echo [%date% %time%] Performing final health check... | tee -a "%LOG_FILE%"
curl -f http://localhost:5001/health >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: Final health check failed | tee -a "%LOG_FILE%"
    exit /b 1
)

echo [%date% %time%] Deployment completed successfully! | tee -a "%LOG_FILE%"
echo [%date% %time%] API is available at: http://localhost:5001 | tee -a "%LOG_FILE%"
echo [%date% %time%] Health check: http://localhost:5001/health | tee -a "%LOG_FILE%"

REM Show service status
echo [%date% %time%] Service status: | tee -a "%LOG_FILE%"
docker-compose ps

echo [%date% %time%] Deployment completed | tee -a "%LOG_FILE%"
pause
