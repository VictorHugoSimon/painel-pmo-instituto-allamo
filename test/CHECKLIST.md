# Bateria de Testes — Portal PMO Allamo
Rodar a CADA alteração, antes de publicar.

## 1. Testes automáticos de API/back/banco
Depois do deploy (ou com `wrangler pages dev public` rodando):
```
node test/smoke.mjs https://allamo-pmo.pages.dev
```
Cobre: login válido/inválido, proteção por token, escopo por perfil, CRUD de projeto,
bloqueio de permissão, Status Report (GET/POST/persistência) e histórico.
Saída deve terminar com **0 falhas**.

## 2. Checklist de usabilidade (front)
- [ ] Login e-mail/senha entra e roteia pelo perfil correto.
- [ ] Admin: vê todas as abas, incluindo Acessos e Histórico.
- [ ] Troca de empresa no topo recarrega os dados.
- [ ] Projetos: criar (+ Novo projeto) e excluir funcionam e aparecem no Histórico.
- [ ] Acessos: criar usuário; e-mail duplicado é recusado.
- [ ] GMUD: aprovar/rejeitar muda o status e grava no Histórico.
- [ ] Acompanhamento: 4 sub-abas, heatmap de cronograma e módulos aparecem.
- [ ] Editar report: alterações salvam e o cliente passa a ver.
- [ ] Gestor/Usuário: só enxergam a própria empresa (sem Acessos/Histórico).
- [ ] Assistente responde e respeita o escopo.

## 3. Banco
- [ ] `SELECT COUNT(*) FROM companies;` = 14
- [ ] `SELECT COUNT(*) FROM users;` ≥ 7
- [ ] `SELECT * FROM audit_log ORDER BY id DESC LIMIT 5;` mostra os últimos eventos
- [ ] `SELECT company_id, ref FROM project_reports;` reflete os reports salvos

## 4. Cron (opcional)
- [ ] Worker `allamo-pmo-cron` publicado (cron `0 6 1 * *`).
- [ ] `SELECT * FROM report_snapshots ORDER BY id DESC LIMIT 3;` cresce após execução.
