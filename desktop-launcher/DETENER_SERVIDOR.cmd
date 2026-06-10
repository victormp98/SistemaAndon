@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SistemaAndon-Launcher.ps1" -Action Stop -NoBrowser
