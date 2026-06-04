@echo off
chcp 65001 > nul
title Nobi Skill — Push to GitHub
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║         Nobi Skill  —  Push to GitHub (NobiMath)        ║
echo  ╠══════════════════════════════════════════════════════════╣
echo  ║  Version bump rules:                                     ║
echo  ║    feat: ...     →  MINOR  (X.Y+1.0)  new feature       ║
echo  ║    fix: ...      →  PATCH  (X.Y.Z+1)  bug fix           ║
echo  ║    refactor: ... →  PATCH              code cleanup      ║
echo  ║    style: ...    →  PATCH              UI only           ║
echo  ║    breaking: ... →  MAJOR  (X+1.0.0)  breaking change   ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ── [1] Read current version ──────────────────────────────────────────────────
for /f "tokens=3 delims='" %%v in ('findstr "APP_VERSION = " src\lib\version.ts') do set CUR_VER=%%v
echo  Current version : v%CUR_VER%
echo.

:: ── [2] Show what changed since last commit ────────────────────────────────────
echo  [2/5] Recent commits:
git log --oneline -6
echo.
echo  Changed files (uncommitted):
git diff --stat HEAD
git status --short
echo.

:: ── [2.5] Change description ────────────────────────────────────────────────────
set /p CHANGE_DESC= Change description (e.g. "feat: Daily Mission"):
if "%CHANGE_DESC%"=="" set CHANGE_DESC=fix: Bug fixes and improvements
echo.

:: ── [3] Bump version ──────────────────────────────────────────────────────────
echo  [3/5] Bumping version...
echo  ( feat: → MINOR   fix/refactor/style: → PATCH   breaking: → MAJOR )
echo.
for /f "delims=" %%i in ('node _bump.cjs "%CHANGE_DESC%" 2^>^&1') do (
  echo  %%i
  set BUMP_OUT=%%i
)
:: Last line is the new version (stdout), earlier lines are stderr info
for /f "delims=" %%i in ('node _bump.cjs "%CHANGE_DESC%"') do set NEW_VER=%%i
if "%NEW_VER%"=="" (
  echo.
  echo  ERROR: _bump.cjs failed — is Node.js installed?
  pause & exit /b 1
)
echo.
echo  ✓ v%CUR_VER%  →  v%NEW_VER%
echo.

:: ── [4] Build ─────────────────────────────────────────────────────────────────
echo  [4/5] Building...
call npx next build 2>nul
if %ERRORLEVEL% neq 0 (
  echo.
  echo  ✗ BUILD FAILED — fix errors before pushing.
  echo    (version.ts already bumped to v%NEW_VER% — just re-run)
  echo.
  pause & exit /b 1
)
echo  ✓ Build OK
echo.

:: ── [5] Git commit + push ─────────────────────────────────────────────────────
echo  [5/5] Committing and pushing...
git add -A
git commit -m "v%NEW_VER%: %CHANGE_DESC%"
git push
echo.

echo  ╔══════════════════════════════════════════════════════════╗
echo  ║  ✓ Done!  v%NEW_VER% deployed                                ║
echo  ║  Actions: https://github.com/9doltada9-dot/NobiMath/actions ║
echo  ║  Site:    https://9doltada9-dot.github.io/NobiMath/         ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
