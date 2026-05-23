@echo off
chcp 65001 >nul
title Nobi Skill - Push to GitHub
cd /d "D:\OneDrive\Project\Claude\Nobi Skill\Nobi Skill"

echo ============================================================
echo    Nobi Skill  -  Push to GitHub (NobiMath)
echo ============================================================
echo.

echo [1/3] git add -A ...
git add -A

echo.
echo [2/3] git commit ...
git commit -m "Phase 3: per-operation level tracking + auto-adjust + AI feedback complete"

echo.
echo [3/3] git push ...
git push

echo.
echo ============================================================
echo    Done.  Watch the build turn green here:
echo    https://github.com/9doltada9-dot/NobiMath/actions
echo    Then open:  https://9doltada9-dot.github.io/NobiMath/
echo ============================================================
echo.
pause
