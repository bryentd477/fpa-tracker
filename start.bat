@echo off
REM FPA Tracker Startup Script for Windows
REM This script installs dependencies and starts the application

echo.
echo =====================================
echo    FPA Tracker - Starting Application
echo =====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Node.js is not installed or not in system PATH
    echo.
    echo Please download and install Node.js from: https://nodejs.org
    echo Then come back and run this script again.
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js detected
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm run install-all
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✓ Dependencies installed
    echo.
)

REM Build the frontend
echo Building React frontend...
cd frontend
if exist "build" (
    echo ✓ Frontend already built
) else (
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to build frontend
        pause
        exit /b 1
    )
)
cd ..
echo ✓ Frontend ready
echo.

REM Start the server
echo =====================================
echo   Starting FPA Tracker Server
echo =====================================
echo.
echo Server running at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

cd backend
node server.js
