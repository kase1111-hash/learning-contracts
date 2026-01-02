@echo off
REM Learning Contracts - Startup Script for Windows
REM This script runs the example usage or starts an interactive session

echo ========================================
echo  Learning Contracts - Startup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18.0.0 or higher from https://nodejs.org
    exit /b 1
)

REM Check if dist folder exists (compiled output)
if not exist "dist" (
    echo.
    echo Build output not found. Running build first...
    call build.bat
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Build failed
        exit /b 1
    )
    echo.
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install dependencies
        exit /b 1
    )
)

echo Running Learning Contracts example...
echo.

REM Run the basic usage example
node dist/examples/basic-usage.js 2>nul
if %ERRORLEVEL% neq 0 (
    REM If example doesn't exist, run a quick verification instead
    echo.
    echo Verifying Learning Contracts module...
    node -e "const lc = require('./dist'); console.log('Learning Contracts v0.1.0-alpha loaded successfully'); console.log('Available exports:', Object.keys(lc).join(', '));"
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to load Learning Contracts module
        exit /b 1
    )
)

echo.
echo ========================================
echo  Learning Contracts is ready!
echo ========================================
echo.
echo Usage in your code:
echo   const { LearningContractsSystem } = require('learning-contracts');
echo   const system = new LearningContractsSystem();
echo.
