@echo off
echo ========================================
echo Database Dump Creation Script
echo ========================================

echo.
echo Creating database dump for Vendor_Management...
echo.

REM Create dump file with timestamp
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Create the dump
pg_dump -h localhost -U postgres -d Vendor_Management -f "vendor_management_dump_%TIMESTAMP%.sql"

if errorlevel 1 (
    echo ERROR: Failed to create database dump
    echo.
    echo Please check:
    echo 1. PostgreSQL is running
    echo 2. Database 'Vendor_Management' exists
    echo 3. User 'postgres' has access
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS! Database dump created
    echo ========================================
    echo.
    echo File: vendor_management_dump_%TIMESTAMP%.sql
    echo.
    echo This file contains:
    echo - All table structures
    echo - All data
    echo - Indexes and constraints
    echo - Sequences and functions
    echo.
    echo Send this file to your production team!
    echo.
)

pause
