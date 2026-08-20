@echo off
setlocal
cd /d %~dp0

echo ==============================================
echo ALLAMO PMO - WORK MANAGEMENT - STAGE
echo ==============================================

call npm install
if errorlevel 1 goto :fail

call npm run build:work
if errorlevel 1 goto :fail

node --check public\_worker.js
if errorlevel 1 goto :fail

call npm run db:stage:work
if errorlevel 1 goto :fail

call npm run deploy:stage
if errorlevel 1 goto :fail

echo.
echo Deploy Stage concluido.
echo URL: https://allamo-pmo-stage.pages.dev

if "%ALLAMO_TEST_EMAIL%"=="" goto :nosmoke
if "%ALLAMO_TEST_PASSWORD%"=="" goto :nosmoke
call npm run test:work:stage
if errorlevel 1 goto :fail

echo.
echo SMOKE TEST OK - STAGE APTO PARA HOMOLOGACAO.
goto :end

:nosmoke
echo.
echo Smoke automatico nao executado porque ALLAMO_TEST_EMAIL / ALLAMO_TEST_PASSWORD nao estao definidos.
echo Defina as variaveis e rode: npm run test:work:stage
goto :end

:fail
echo.
echo ERRO: processo interrompido. NAO promover para producao.
exit /b 1

:end
endlocal
