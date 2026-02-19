#!/bin/bash

# FPA Tracker Startup Script (macOS/Linux)
# This script installs dependencies and starts the application

echo ""
echo "====================================="
echo "  FPA Tracker - Starting Application"
echo "====================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo ""
    echo "ERROR: Node.js is not installed"
    echo ""
    echo "Please download and install Node.js from: https://nodejs.org"
    echo "Then come back and run this script again."
    echo ""
    exit 1
fi

echo "✓ Node.js detected"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm run install-all
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo "✓ Dependencies installed"
    echo ""
fi

# Build the frontend
echo "Building React frontend..."
cd frontend
if [ -d "build" ]; then
    echo "✓ Frontend already built"
else
    npm run build
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Failed to build frontend"
        exit 1
    fi
fi
cd ..
echo "✓ Frontend ready"
echo ""

# Start the server
echo "====================================="
echo " Starting FPA Tracker Server"
echo "====================================="
echo ""
echo "Server running at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd backend
node server.js
