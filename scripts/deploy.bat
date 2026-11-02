@echo off
title Deploy Mirror Solar CRM - Automated Firebase Deployment
cd /d "%~dp0.."

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
echo [1/3] Building production bundle...
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
echo [2/3] Verifying Firebase Account: mirrorsolarvision@gmail.com...
call npx --yes firebase login:list | findstr /C:"mirrorsolarvision@gmail.com" >nul 2>&1
if %errorlevel% neq 0 (
    echo Switching or logging in mirrorsolarvision@gmail.com...
    call npx --yes firebase login:add mirrorsolarvision@gmail.com
)
call npx --yes firebase login:use mirrorsolarvision@gmail.com >nul 2>&1
echo [OK] Active Firebase account: mirrorsolarvision@gmail.com
echo.

:: 3. Deploy
if "%DEPLOY_TARGET%"=="hosting" goto deploy_hosting
if "%DEPLOY_TARGET%"=="rules" goto deploy_rules
goto deploy_all

:deploy_hosting
echo [3/3] Deploying Frontend - Hosting only...
call npx --yes firebase deploy --only hosting --project crm-webapp-d32bc
goto after_deploy

:deploy_rules
echo [3/3] Deploying Security Rules only - Firestore and Storage...
call npx --yes firebase deploy --only firestore:rules,storage --project crm-webapp-d32bc
goto after_deploy

:deploy_all
echo [3/3] Deploying Full CRM - Hosting, Firestore Rules, and Storage...
call npx --yes firebase deploy --project crm-webapp-d32bc
goto after_deploy

:after_deploy
if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo [RETRY] Trying fallback deployment with mirrorsolarvision@gmail.com...
    call npx --yes firebase login:use mirrorsolarvision@gmail.com >nul 2>&1
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
