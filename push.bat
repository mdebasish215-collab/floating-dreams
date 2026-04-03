@echo off
echo Adding new changes...
git add .
echo Committing changes...
git commit -m "Update audio player to stream through backend"
echo Pushing to GitHub (this will trigger Railway automatically)...
git push

echo.
echo Deployment triggered! Check your Railway dashboard.
pause
