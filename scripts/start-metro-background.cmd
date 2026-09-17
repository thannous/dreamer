@echo off
cd /d "%~dp0.."
if "%~1"=="" (
  set "METRO_PORT=8081"
) else (
  set "METRO_PORT=%~1"
)
start "metro" /min cmd /c "set \"CI=true\" && npx expo start --dev-client --clear --port %METRO_PORT% > metro.log 2>&1"
