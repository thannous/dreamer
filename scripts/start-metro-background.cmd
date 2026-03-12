@echo off
cd /d "%~dp0.."
start "metro" /min cmd /c "set \"CI=true\" && npx expo start --dev-client --host localhost > metro.log 2>&1"
