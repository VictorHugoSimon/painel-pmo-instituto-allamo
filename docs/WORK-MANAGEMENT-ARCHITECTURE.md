# Államo Work Management — Arquitetura operacional

## Princípio
O Államo Work Management é o núcleo próprio de tarefas e demandas do Instituto Államo. O Linear não é dependência operacional. Quando usado, atua apenas como integração opcional de leitura/importação.

## Fonte de verdade
- Banco: Cloudflare D1.
- Entidade central: `issues`, evoluída para Work Items.
- Planejamento: `sprints`.
- Colaboração: `issue_comments` e `issue_checklist`.
- Dependências: `issue_links`.
- Adoção/heatmap: `work_events`.
- Auditoria corporativa: `audit_log` já existente.

## Fluxo
Demanda/Tarefa → Backlog → Kanban → Sprint → Execução → Homologação → Concluído.

## Kanban padrão
1. BACKLOG
2. A FAZER
3. EM ANDAMENTO
4. CODE REVIEW
5. QA
6. HOMOLOGAÇÃO
7. CONCLUÍDO

## Segurança
- Autorização no backend.
- Escopo por empresa para perfis vinculados a cliente.
- Exclusão lógica de Work Items via `archived_at`.
- Comentários/checklists com exclusão lógica.
- Links somente entre itens da mesma empresa.
- Sprint somente pode receber itens compatíveis com a mesma empresa/projeto.

## Integrações
Linear, Jira e outras ferramentas são conectores opcionais. Nenhuma delas deve impedir criação, edição, priorização, movimentação ou conclusão de trabalho dentro do Államo.
