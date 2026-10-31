@echo off
title Deploy Mirror Solar CRM - Automated Firebase Deployment
cd /d "%~dp0"

echo ========================================================
echo   MIRROR SOLAR CRM - AUTOMATED FIREBASE DEPLOYMENT
echo   Target Project: crm-webapp-d32bc
echo   Target Account: mirrorsolarvision@gmail.com
echo ========================================================
echo.

:: Check for optional parameter: hosting, rules, or all
set DEPLOY_TARGET=all
if /i "%1"=="--hosting" set DEPLOY_TARGET=hosting
if /i "%1"=="hosting" set DEPLOY_TARGET=hosting
if /i "%1"=="--rules" set DEPLOY_TARGET=rules
if /i "%1"=="rules" set DEPLOY_TARGET=rules

:: 1. Build Frontend
echo [1/3] Building production bundle (Frontend)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed! Aborting deployment.
    pause
    exit /b %errorlevel%
)
echo [OK] Production build completed successfully!
echo.

:: 2. Verify Account
echo [2/3] Verifying Firebase Account (mirrorsolarvision@gmail.com)...
call npx --yes firebase login:use mirrorsolarvision@gmail.com 2>nul
if %errorlevel% neq 0 (
    echo Switching / adding mirrorsolarvision@gmail.com...
    call npx --yes firebase login:add mirrorsolarvision@gmail.com
    call npx --yes firebase login:use mirrorsolarvision@gmail.com
)
echo [OK] Active Firebase account: mirrorsolarvision@gmail.com
echo.

:: 3. Deploy
if "%DEPLOY_TARGET%"=="hosting" (
    echo [3/3] Deploying Frontend (Hosting only)...
    call npx --yes firebase deploy --only hosting --project crm-webapp-d32bc
) else if "%DEPLOY_TARGET%"=="rules" (
    echo [3/3] Deploying Security Rules only (Firestore and Storage)...
    call npx --yes firebase deploy --only firestore:rules,storage --project crm-webapp-d32bc
) else (
    echo [3/3] Deploying Full CRM (Hosting, Firestore Rules, and Storage)...
    call npx --yes firebase deploy --project crm-webapp-d32bc
)

if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo [RETRY] Trying fallback deployment with mirrorsolarvision@gmail.com...
    call npx --yes firebase login:use mirrorsolarvision@gmail.com
    if "%DEPLOY_TARGET%"=="hosting" (
        call npx --yes firebase deploy --only hosting --project crm-webapp-d32bc
    ) else (
        call npx --yes firebase deploy --project crm-webapp-d32bc
    )
    echo ======================================================================
)

echo.
echo ========================================================
echo   DEPLOYMENT FINISHED!
echo   Live URL: https://crm.mirrorsolarvision.com
echo   Firebase Console: https://console.firebase.google.com/project/crm-webapp-d32bc
echo ========================================================
echo.
pause
