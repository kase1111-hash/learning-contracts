@echo off
REM Learning Contracts - Build Script for Windows
REM This script compiles the TypeScript source to JavaScript

echo ========================================
echo  Learning Contracts - Build
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18.0.0 or higher from https://nodejs.org
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1" %%v in ('node -v') do set NODE_VERSION=%%v
echo Node.js version: %NODE_VERSION%

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

echo.
echo Running TypeScript compiler...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Build failed
    exit /b 1
)

echo.
echo ========================================
echo  Build completed successfully!
echo  Output: dist/
echo ========================================
