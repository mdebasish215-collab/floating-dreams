@echo off
set RAILWAY_TOKEN=df8e6e90-471e-43a0-80ee-d3fe8c6c1473
set PATH=C:\PROGRA~1\nodejs;C:\Users\DEBASISH\AppData\Roaming\npm;%PATH%
echo Token set. Testing auth...
railway whoami
echo Exit code: %ERRORLEVEL%
