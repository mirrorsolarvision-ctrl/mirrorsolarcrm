@echo off
title Mirror Solar CRM - Live Deployment
cd /d "%~dp0"
echo ========================================================
echo  MIRROR SOLAR CRM - LIVE DEPLOYMENT
echo ========================================================
echo.
echo Step 1: Enforcing Firebase account mirrorsolarvision@gmail.com...
call npx --yes firebase login:list | find "Logged in as mirrorsolarvision@gmail.com" >nul 2>&1
if %errorlevel% neq 0 (
    echo Switching account to mirrorsolarvision@gmail.com...
    call npx --yes firebase login:use mirrorsolarvision@gmail.com >nul 2>&1
    if %errorlevel% neq 0 (
        echo [FIREBASE LOGIN REQUIRED]
        echo Opening browser to log in with mirrorsolarvision@gmail.com...
        call npx --yes firebase login:add mirrorsolarvision@gmail.com
        call npx --yes firebase login:use mirrorsolarvision@gmail.com
    )
)
echo Verified active account: mirrorsolarvision@gmail.com
echo.
echo Step 2: Compiling production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Aborting deployment.
    pause
    exit /b 1
)
echo.
echo Step 3: Deploying Frontend and Backend to crm.mirrorsolarvision.com (Project: crm-webapp-d32bc)...
echo.
call npx --yes firebase deploy --project crm-webapp-d32bc
if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo  [FAILED] Deployment to crm-webapp-d32bc encountered an error!
    echo ========================================================
    pause
    exit /b 1
)
echo.
echo ========================================================
echo  SUCCESS: crm.mirrorsolarvision.com IS NOW LIVE!
echo ========================================================
echo Refresh your phone or browser at crm.mirrorsolarvision.com
echo.
pause
