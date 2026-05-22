# ============================================================
#  Nobi Skill  ->  GitHub repo: 9doltada9-dot/NobiMath
#  This REPLACES the old prototype in NobiMath with the
#  current Next.js project (force push).
# ============================================================

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/9doltada9-dot/NobiMath.git"

# Move to the folder this script lives in
Set-Location -Path $PSScriptRoot
Write-Host "Working in: $PSScriptRoot" -ForegroundColor Cyan

# 1) Initialize git (safe to run again)
if (-not (Test-Path ".git")) {
    git init | Out-Null
    Write-Host "git initialized." -ForegroundColor Green
} else {
    Write-Host "git already initialized." -ForegroundColor Yellow
}

# 2) Identity (only sets if missing)
if (-not (git config user.name))  { git config user.name  "9doltada9-dot" }
if (-not (git config user.email)) { git config user.email "9doltada9@gmail.com" }

# 3) Stage + commit
git add -A
git commit -m "Replace prototype with Next.js app (Nobi Skill - adaptive math practice)" 2>$null
Write-Host "Committed (or nothing new to commit)." -ForegroundColor Green

# 4) Branch main
git branch -M main

# 5) Remote (add if missing, else update URL)
if (git remote | Select-String -Quiet "^origin$") {
    git remote set-url origin $RepoUrl
} else {
    git remote add origin $RepoUrl
}
Write-Host "Remote origin -> $RepoUrl" -ForegroundColor Cyan

# 6) Force push -> replaces old prototype on NobiMath
#    (a browser window may open the first time to authenticate)
git push -u origin main --force

Write-Host ""
Write-Host "Done! Open: https://github.com/9doltada9-dot/NobiMath" -ForegroundColor Green
