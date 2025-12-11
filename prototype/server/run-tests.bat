@echo off
REM ============================================
REM OITH Test Runner
REM ============================================
REM Usage: run-tests.bat [option]
REM Options:
REM   (none)      - Run all tests
REM   unit        - Run unit tests only
REM   integration - Run integration tests only
REM   matching    - Run matching tests only
REM   users       - Run users tests only
REM   coverage    - Run tests with coverage report
REM   watch       - Run tests in watch mode
REM ============================================

echo.
echo =============================================
echo   OITH Test Suite
echo =============================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Check for Jest
where jest >nul 2>&1
if errorlevel 1 (
    echo Installing Jest...
    call npm install --save-dev jest supertest
    echo.
)

set OPTION=%1

if "%OPTION%"=="" (
    echo Running all tests...
    call npm test
    goto :end
)

if "%OPTION%"=="unit" (
    echo Running unit tests...
    call npm run test:unit
    goto :end
)

if "%OPTION%"=="integration" (
    echo Running integration tests...
    call npm run test:integration
    goto :end
)

if "%OPTION%"=="matching" (
    echo Running matching tests...
    call npm run test:matching
    goto :end
)

if "%OPTION%"=="users" (
    echo Running users tests...
    call npm run test:users
    goto :end
)

if "%OPTION%"=="coverage" (
    echo Running tests with coverage...
    call npm run test:coverage
    echo.
    echo Coverage report generated in /coverage directory
    goto :end
)

if "%OPTION%"=="watch" (
    echo Running tests in watch mode...
    call npm run test:watch
    goto :end
)

echo Unknown option: %OPTION%
echo Valid options: unit, integration, matching, users, coverage, watch
exit /b 1

:end
echo.
echo =============================================
echo   Tests Complete
echo =============================================


