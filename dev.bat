@echo off
title ONIX Dev Server
echo [ONIX] Starting development server with auto-reload...
echo [ONIX] Watching server.js for changes — just refresh browser for HTML/txt edits
echo.
node --watch server.js
pause
