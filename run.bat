@echo off
setlocal

pushd "%~dp0"

if not exist node_modules (
  call npm install || exit /b 1
)

call npm run dev

popd
