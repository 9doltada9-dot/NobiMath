@echo off
title Nobi Skill - Push to GitHub
cd /d "D:\OneDrive\Project\Claude\Nobi Skill\Nobi Skill"

echo ============================================================
echo    Nobi Skill  -  Push to GitHub (NobiMath)
echo ============================================================
echo.

:: [1/5] Ask for change description (English only to avoid cmd encoding issues)
set /p CHANGE_DESC=Change description (press Enter to skip):
if "%CHANGE_DESC%"=="" set CHANGE_DESC=Bug fixes and improvements

:: [2/5] Bump version
echo.
echo [2/5] Bumping version...
for /f "delims=" %%i in ('node _bump.cjs "%CHANGE_DESC%"') do set NEW_VER=%%i
if "%NEW_VER%"=="" (
  echo ERROR: _bump.cjs failed - check Node.js is installed
  pause
  exit /b 1
)
echo     New version: v%NEW_VER%

:: [3/5] Build check
echo.
echo [3/5] Running next build...
echo.
call npx next build
if %ERRORLEVEL% neq 0 (
  echo.
  echo ============================================================
  echo    BUILD FAILED - fix errors before pushing
  echo    (version.ts was bumped - just run _push.bat again)
  echo ============================================================
  echo.
  pause
  exit /b 1
)

:: [4/5] Git commit
echo.
echo [4/5] git add + commit...
git add -A
git commit -m "v%NEW_VER%: %CHANGE_DESC%"

:: [5/5] Git push
echo.
echo [5/5] git push...
git push

echo.
echo ============================================================
echo    Done!  v%NEW_VER% deployed
echo    Actions: https://github.com/9doltada9-dot/NobiMath/actions
echo    Site:    https://9doltada9-dot.github.io/NobiMath/
echo ============================================================
echo.
pause
