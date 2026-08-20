# Államo Work Management — Fase 1

## Objetivo
Evoluir o Portal PMO para incluir uma camada operacional de gestão de trabalho inspirada nas capacidades centrais do Jira, preservando a arquitetura existente e integrando execução com governança PMO.

## Regras de implementação
- Não editar `public/index.html` diretamente enquanto o arquivo-fonte `Portal Allamo PMO.dc.html` não estiver disponível no repositório.
- Preservar Cloudflare Pages Advanced Mode, `public/_worker.js`, D1 e Workers AI.
- Publicar primeiro em STAGE; somente depois de validar, promover para PRODUÇÃO.
- Não duplicar a tabela `issues`; evoluí-la para Work Items.
- Toda autorização deve existir no backend, não apenas na interface.
- Toda ação crítica deve gerar auditoria.
- Não implantar escrita bidirecional com Linear nesta fase.

## Escopo funcional da Fase 1

### 1. Work Items
Evoluir `issues` para suportar:
- tipos: Epic, Feature, Story, Task, Subtask, Bug, Melhoria, Incidente, Ação, Requisito e Marco;
- descrição;
- hierarquia por `parent_id`;
- sprint;
- release;
- data de início e prazo;
- estimativa e story points;
- ordenação do backlog;
- responsável e solicitante;
- comentários;
- checklist;
- relacionamentos entre itens;
- arquivamento lógico.

### 2. Backlog
Criar visão de backlog com:
- ordenação por drag-and-drop;
- filtros por empresa, projeto, tipo, prioridade, responsável, sprint e status;
- edição rápida;
- seleção múltipla;
- mover item para sprint;
- mostrar itens sem estimativa e bloqueados.

### 3. Board Kanban
Criar board com colunas inicialmente fixas/configuráveis por status:
- Backlog
- A Fazer
- Em Andamento
- Review
- QA/Homologação
- Concluído

Requisitos:
- drag-and-drop;
- validação server-side da mudança de status;
- WIP visual em fase posterior;
- cards com id, título, tipo, prioridade, responsável, prazo e estimativa;
- filtros rápidos.

### 4. Sprints
Criar CRUD de sprint com:
- empresa;
- projeto;
- nome;
- objetivo;
- status (`planned`, `active`, `completed`, `cancelled`);
- início/fim;
- capacidade;
- timestamps de início e conclusão.

Fluxos:
- Planejar sprint;
- Adicionar/remover itens;
- Iniciar sprint;
- Concluir sprint;
- Ao concluir, itens incompletos devem ter destino explícito.

### 5. Relacionamentos
Tabela `issue_links` deve suportar inicialmente:
- blocks
- is_blocked_by
- depends_on
- relates_to
- duplicates

### 6. Comentários e checklist
Itens devem aceitar comentários e checklist com auditoria básica.

### 7. Telemetria
Registrar eventos mínimos em `work_event_log`:
- work_item.created
- work_item.updated
- work_item.status_changed
- backlog.viewed
- backlog.rank_changed
- board.viewed
- board.card_moved
- sprint.created
- sprint.started
- sprint.completed

Não registrar texto integral de comentários ou descrições no analytics.

## Endpoints sugeridos

### Issues / Work Items
- `GET /api/issues`
- `POST /api/issues`
- `GET /api/issues/:id`
- `PATCH /api/issues/:id`
- `POST /api/issues/:id/transition`
- `POST /api/issues/:id/comments`
- `GET /api/issues/:id/comments`
- `POST /api/issues/:id/links`
- `GET /api/issues/:id/links`
- `POST /api/issues/:id/checklist`

### Sprints
- `GET /api/sprints`
- `POST /api/sprints`
- `PATCH /api/sprints/:id`
- `POST /api/sprints/:id/start`
- `POST /api/sprints/:id/complete`

### Backlog / Board
- `GET /api/work/backlog`
- `POST /api/work/rank`
- `GET /api/work/board`

## Regras de autorização
- `admin`, `pmo`, `techlead`: gestão de work items dentro do escopo autorizado.
- `usuario`: leitura apenas do cliente/empresa autorizada.
- qualquer perfil vinculado a empresa nunca pode consultar ou alterar outra empresa.
- validar `company_id` de todos os objetos relacionados no backend.

## Critérios de aceite do backend
1. Criar item gera id único e auditoria.
2. Usuário sem permissão recebe 403.
3. Cliente A não acessa item do Cliente B.
4. Item pai e filho pertencem ao mesmo tenant/empresa.
5. Sprint pertence à mesma empresa/projeto do item.
6. Ordenação do backlog persiste após reload.
7. Transição inválida é recusada.
8. Início e conclusão de sprint geram timestamps e eventos.
9. Comentários e checklists ficam vinculados ao item correto.
10. Eventos de telemetria não armazenam conteúdo sensível.

## Ordem de implementação
1. Migration D1.
2. Endpoints CRUD de Work Items.
3. Endpoints de sprint.
4. Endpoints de comentários/checklist/links.
5. Backlog API e ranking.
6. Board API e transições.
7. Eventos de telemetria.
8. Front no `.dc.html`.
9. Compilar `public/index.html`.
10. STAGE → smoke test → validação funcional → PRODUÇÃO.

## Dependência bloqueadora atual
O handoff determina que o front deve ser alterado em `Portal Allamo PMO.dc.html` e recompilado. Esse arquivo não está atualmente presente no repositório `painel-pmo-instituto-allamo`. Portanto, mudanças de front devem aguardar o arquivo-fonte ou um mecanismo documentado de compilação, evitando alterações manuais no `public/index.html`.

## Fora do escopo desta fase
- sincronização bidirecional com Linear/Jira;
- automações complexas;
- IA autônoma;
- workflows customizáveis por cliente;
- Gantt avançado;
- capacity planning avançado;
- SLA;
- portal de solicitações completo;
- Product Discovery.
