@echo off
setlocal
chcp 65001 >nul
title Portal PMO Allamo - Atualizar (migração + deploy + teste)
cd /d "%~dp0"

echo ==================================================
echo   ATUALIZANDO O PORTAL (banco + site + teste)
echo ==================================================
echo.

echo [1/3] Aplicando migracoes no banco REMOTO (D1)...
echo   (erros de "duplicate column" sao normais se ja aplicado)

echo   Verificando versao do arquivo da API...
findstr /C:"company-create" "public\_worker.js" >nul
if errorlevel 1 (
  echo.
  echo   [ATENCAO] O arquivo public\_worker.js parece ser uma versao ANTIGA ou ausente.
  echo   Extraia o pacote de novo numa pasta NOVA e rode daqui.
  echo.
  pause
)
call wrangler d1 execute allamo-pmo --remote --file=./migration-historico.sql
call wrangler d1 execute allamo-pmo --remote --file=./migration-status-report.sql
call wrangler d1 execute allamo-pmo --remote --file=./migration-v3.sql
echo.

echo [2/3] Publicando o site na producao...
call wrangler pages deploy public --project-name allamo-pmo --branch main
echo.

echo [3/3] Rodando a bateria de testes...
call node test/smoke.mjs https://allamo-pmo.pages.dev
echo.

echo ==================================================
echo   Concluido. Veja o resultado dos testes acima.
echo   Abra o site e use Ctrl+Shift+R.
echo ==================================================
pause
