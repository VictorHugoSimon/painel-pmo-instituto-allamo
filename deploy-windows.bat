@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Portal PMO Allamo - Deploy

echo ==================================================
echo   PORTAL PMO ALLAMO - DEPLOY CLOUDFLARE
echo ==================================================
echo.
echo Pasta atual: %CD%
echo.

REM Garante que estamos na pasta do script
cd /d "%~dp0"

REM Confere arquivos essenciais
if not exist "wrangler.toml" (
  echo [ERRO] wrangler.toml nao encontrado nesta pasta.
  echo Coloque este .bat DENTRO da pasta deploy e rode de novo.
  echo.
  goto :fim
)

REM Verifica Node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  echo Instale a versao LTS em https://nodejs.org e rode de novo.
  echo.
  goto :fim
)
echo Node encontrado:
node -v
echo.

echo [1/6] Instalando Wrangler...
call npm install -g wrangler
if errorlevel 1 ( echo [ERRO] Falha ao instalar Wrangler. & goto :fim )
echo.

echo [2/6] Login na Cloudflare (vai abrir o navegador)...
call wrangler login
echo.

echo [3/6] Criando o banco D1 allamo-pmo...
call wrangler d1 create allamo-pmo > d1_create.txt 2>&1
type d1_create.txt

set "DBID="
for /f "tokens=2 delims==" %%A in ('findstr /i "database_id" d1_create.txt') do set "RAW=%%A"
if defined RAW (
  set "RAW=!RAW:"=!"
  set "RAW=!RAW: =!"
  set "DBID=!RAW!"
)
if not defined DBID (
  echo.
  echo Nao consegui ler o id automaticamente.
  echo Copie o database_id mostrado acima e cole aqui:
  set /p DBID=database_id: 
)
echo.

echo [4/6] Gravando o id no wrangler.toml...
powershell -NoProfile -Command "(Get-Content 'wrangler.toml') -replace 'COLE_AQUI_O_ID_DO_D1','%DBID%' | Set-Content 'wrangler.toml'"
echo    id aplicado: %DBID%
echo.

echo [5/6] Criando tabelas e carregando dados...
call wrangler d1 execute allamo-pmo --remote --file=./schema.clean.sql
call wrangler d1 execute allamo-pmo --remote --file=./seed.clean.sql
echo.

echo [6/6] Publicando o site...
call wrangler pages deploy public --project-name allamo-pmo
echo.

echo ==================================================
echo   PRONTO! Falta so vincular o banco (uma vez):
echo   Workers e Pages ^> allamo-pmo ^> Settings ^> Functions
echo   ^> D1 database bindings ^> Add binding
echo   Variable name: DB    Database: allamo-pmo    Save
echo   Depois: Deployments ^> Retry deployment
echo.
echo   Login: renan.rondon@institutoallamo.com.br / allamo123
echo ==================================================
del d1_create.txt >nul 2>nul

:fim
echo.
echo ---- Fim. Pressione uma tecla para fechar. ----
pause >nul
