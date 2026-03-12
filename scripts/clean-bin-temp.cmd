@echo off
cd /d "%~dp0.."
for /d /r %%D in (.bin) do (
  if /i "%%~nxD"==".bin" (
    for %%F in ("%%D\.*-*") do (
      del /f /q "%%~fF" >nul 2>&1
    )
  )
)
