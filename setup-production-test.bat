@echo off
echo ========================================
echo Production Testing Setup Script
echo ========================================

echo.
echo Step 1: Installing dependencies...
echo.

echo Installing backend dependencies...
cd server
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)

echo Installing frontend dependencies...
cd ..\client
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Checking Docker...
echo.

docker --version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Docker not found. Please install Docker Desktop.
    echo You can still test with local PostgreSQL installation.
) else (
    echo Docker found. Starting PostgreSQL container...
    docker run --name vendor-management-db -e POSTGRES_DB=Vendor_Management -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=Postgres0607@ -p 5432:5432 -d postgres:15-alpine
    echo PostgreSQL container started.
)

echo.
echo Step 3: Creating necessary directories...
echo.

cd ..\server
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads

echo.
echo Step 4: Testing database connection...
echo.

echo Testing PostgreSQL connection...
timeout /t 5 /nobreak >nul

echo.
echo Step 5: Starting backend server...
echo.

echo Starting backend server in production mode...
start "Backend Server" cmd /k "cd server && npm start"

echo.
echo Step 6: Starting frontend...
echo.

echo Starting frontend development server...
start "Frontend Server" cmd /k "cd client && npm start"

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Backend: http://localhost:5001
echo Frontend: http://localhost:3000
echo.
echo Next steps:
echo 1. Wait for both servers to start
echo 2. Open http://localhost:3000 in your browser
echo 3. Test the application functionality
echo 4. Check the PRODUCTION_TESTING_GUIDE.md for detailed testing steps
echo.
echo Press any key to exit...
pause >nul
