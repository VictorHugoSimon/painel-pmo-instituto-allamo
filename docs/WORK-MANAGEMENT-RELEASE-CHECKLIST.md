# Checklist de liberação — Államo Work Management

## Regra
Não publicar produção antes de concluir todos os itens de Stage.

## Preparação local
1. Checkout `feature/work-management-fase1`.
2. Backup do D1 de Stage.
3. Executar `migration-work-management-fase1.sql` no D1 de Stage.
4. Executar `node scripts/build-work-management.mjs` para gerar o Worker e UI a partir das fontes versionadas.
5. Confirmar que o build adicionou os marcadores `BEGIN ALLAMO WORK MANAGEMENT` e `BEGIN ALLAMO WORK MANAGEMENT UI`.

## Stage — API
- Login Admin e PMO.
- GET/POST/PUT Work Items.
- Transição entre todas as colunas do workflow.
- Comentários e checklist.
- Criação, início e conclusão de sprint.
- Filtros por empresa, projeto, status, tipo, sprint, owner e prioridade.
- Bloqueio de acesso cross-company para gestor/usuário.
- Auditoria das operações de escrita.
- Telemetria e analytics.
- Rodar `ALLAMO_TEST_EMAIL=... ALLAMO_TEST_PASSWORD=... node test/work-management-smoke.mjs <URL_STAGE>`.

## Stage — UI
- Botão Trabalho abre módulo sem afetar telas atuais.
- Board renderiza 7 colunas.
- Drag-and-drop persiste status.
- Backlog lista itens e ordenação.
- Novo Work Item grava no D1.
- Sprint grava no D1.
- Responsividade desktop/tablet.
- Login/logout continuam funcionando.
- Empresas, Projetos, Reports, GMUD, Histórico, Copiloto e portal do cliente sem regressão.

## Banco / rollback
- A migration é aditiva; não remove dados existentes.
- Antes de produção, gerar backup/export do D1.
- Em rollback de aplicação, retornar ao commit anterior. As novas tabelas/colunas podem permanecer sem afetar as rotas antigas.

## Produção
1. Backup D1 produção.
2. Aplicar migration.
3. Gerar build.
4. Publicar pacote produção.
5. Confirmar `Deployment complete`.
6. Limpar Service Worker/cache PWA conforme procedimento vigente.
7. Smoke test de leitura e criação controlada.
8. Validar portal do cliente e isolamento por empresa.
9. Registrar versão, data, responsável e evidência no Histórico/GMUD.

## Critério Go/No-Go
GO somente se: smoke API OK + isolamento OK + regressão core OK + backup confirmado. Qualquer falha nesses quatro itens = NO-GO.
