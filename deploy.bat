@echo off
title Mirror Solar CRM - Live Deployment
cd /d "%~dp0"
echo ========================================================
echo  MIRROR SOLAR CRM - LIVE DEPLOYMENT
echo ========================================================
echo.
echo Step 1: Logging out of previous session...
call npx firebase-tools logout
echo.
echo Step 2: Logging in as mirrorsolarvision@gmail.com...
echo A browser window will open now.
echo *** IMPORTANT: Select mirrorsolarvision@gmail.com ***
echo.
call npx firebase-tools login
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Login was not completed.
    pause
    exit /b 1
)
echo.
echo Step 3: Compiling production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo.
echo Step 4: Deploying to crm.mirrorsolarvision.com (Project: crm-webapp-d32bc)...
echo.
call npx firebase-tools deploy --only hosting --project crm-webapp-d32bc
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
