@echo off
setlocal

pushd "%~dp0"

echo ========================================
echo   Instalador de Jira Notifications
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en el PATH.
  echo Instale Node.js 20.19+ o 22.12+ y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no esta disponible en el PATH.
  pause
  exit /b 1
)

echo Version de Node.js:
node --version
echo Version de npm:
npm --version
echo.

echo [1/3] Instalando dependencias del proyecto...
call npm ci
if errorlevel 1 (
  echo ERROR: No se pudieron instalar las dependencias.
  pause
  exit /b 1
)

echo.
echo [2/3] Instalando Chromium para Playwright...
call npx playwright install chromium
if errorlevel 1 (
  echo ERROR: No se pudo instalar Chromium para Playwright.
  pause
  exit /b 1
)

echo.
echo [3/3] Preparando carpetas locales...
for %%D in (data logs exports temp tmp) do (
  if not exist "%%D" mkdir "%%D"
)

echo.
echo Instalacion completada correctamente.
echo.
echo Iniciando la aplicacion...
start "" "%SystemRoot%\System32\wscript.exe" "%~dp0run.vbs"
popd
exit /b 0
