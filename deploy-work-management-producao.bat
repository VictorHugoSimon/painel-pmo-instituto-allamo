@echo off
setlocal
cd /d %~dp0

echo ==============================================
echo ALLAMO PMO - WORK MANAGEMENT - PRODUCAO
echo ==============================================
echo ATENCAO: rode somente depois de homologar o Stage.
set /p CONFIRMA=Digite PRODUCAO para continuar: 
if /I not "%CONFIRMA%"=="PRODUCAO" goto :cancel

call npm install
if errorlevel 1 goto :fail

call npm run build:work
if errorlevel 1 goto :fail

node --check public\_worker.js
if errorlevel 1 goto :fail

call npm run db:prod:work
if errorlevel 1 goto :fail

call npm run deploy:prod
if errorlevel 1 goto :fail

echo.
echo Deploy de producao concluido.
echo URL: https://allamo-pmo.pages.dev

echo IMPORTANTE: limpar Service Worker/cache PWA se a versao antiga continuar aparecendo.

if "%ALLAMO_TEST_EMAIL%"=="" goto :end
if "%ALLAMO_TEST_PASSWORD%"=="" goto :end
call npm run test:work:prod
if errorlevel 1 goto :fail

echo SMOKE TEST DE PRODUCAO OK.
goto :end

:cancel
echo Operacao cancelada.
exit /b 0

:fail
echo.
echo ERRO: deploy interrompido. Verifique logs antes de qualquer nova tentativa.
exit /b 1

:end
endlocal
