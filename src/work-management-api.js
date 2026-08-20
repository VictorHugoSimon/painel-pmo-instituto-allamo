// Államo Work Management — rotas injetadas em handleApi após autenticação/escopo.
// Núcleo independente do Linear: D1 é a fonte de verdade para tarefas/demandas do Kanban.

const wmCanWrite = ['admin','pmo','gestor','techlead'].includes(user.role);
const wmCanManageSprint = ['admin','pmo','techlead'].includes(user.role);
const wmCompanyAllowed = (companyId) => !scope || companyId === scope;
const wmAllowedStatuses = ['BACKLOG','A FAZER','EM ANDAMENTO','CODE REVIEW','QA','HOMOLOGAÇÃO','CONCLUÍDO','CANCELADO'];
const wmAllowedTypes = ['EPIC','FEATURE','STORY','TASK','SUBTASK','BUG','INCIDENT','IMPROVEMENT','ACTION','REQUIREMENT','MILESTONE'];
const wmAllowedLinks = ['blocks','is_blocked_by','depends_on','relates_to','duplicates'];
const wmGetIssue = async id => DB.prepare('SELECT * FROM issues WHERE id=? AND archived_at IS NULL').bind(id).first();
const wmGetSprint = async id => DB.prepare('SELECT * FROM sprints WHERE id=?').bind(id).first();
const wmEmit = async (companyId, projectId, issueId, type, name, metadata={}) => {
  await DB.prepare("INSERT INTO work_events(company_id,project_id,issue_id,event_type,event_name,actor,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))")
    .bind(companyId||null,projectId||null,issueId||null,type||'usage',name,user.name,JSON.stringify(metadata)).run();
};
const wmIssueId = async (type='TASK') => {
  const prefix = ({EPIC:'EPIC',FEATURE:'FEAT',STORY:'STORY',TASK:'TASK',SUBTASK:'SUB',BUG:'BUG',INCIDENT:'INC',IMPROVEMENT:'IMP',ACTION:'ACT',REQUIREMENT:'REQ',MILESTONE:'MS'})[String(type).toUpperCase()] || 'TASK';
  for (let n=0;n<5;n++) {
    const id='ALL-'+prefix+'-'+String(Date.now()).slice(-6)+(n||'');
    if(!(await DB.prepare('SELECT id FROM issues WHERE id=?').bind(id).first())) return id;
  }
  return 'ALL-'+prefix+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
};
const wmValidateParent = async (parentId, companyId) => {
  if(!parentId) return true;
  const p=await wmGetIssue(parentId);
  return !!(p && p.company_id===companyId);
};
const wmValidateSprint = async (sprintId, companyId, projectId) => {
  if(!sprintId) return true;
  const s=await wmGetSprint(sprintId);
  if(!s || s.company_id!==companyId) return false;
  return !projectId || !s.project_id || String(s.project_id)===String(projectId);
};

// WORK ITEMS — LISTA / BUSCA
if (path === 'work-items' && request.method === 'GET') {
  const clauses=['archived_at IS NULL']; const args=[];
  if (scope) { clauses.push('company_id=?'); args.push(scope); }
  for (const [param,col] of [['project','project'],['project_id','project_id'],['status','status'],['type','item_type'],['sprint','sprint_id'],['owner','owner'],['priority','priority']]) {
    const v=url.searchParams.get(param); if(v){ clauses.push(col+'=?'); args.push(v); }
  }
  const q=url.searchParams.get('q'); if(q){ clauses.push('(title LIKE ? OR COALESCE(description,\'\') LIKE ? OR id LIKE ?)'); args.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
  const sql='SELECT * FROM issues WHERE '+clauses.join(' AND ')+' ORDER BY COALESCE(rank,0) ASC, COALESCE(updated_at,created_at) DESC, id DESC';
  return json((await DB.prepare(sql).bind(...args).all()).results);
}

// WORK ITEMS — CRIAR
if (path === 'work-items' && request.method === 'POST') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const b=await request.json();
  if(!b.title||!b.company_id) return json({error:'Título e empresa são obrigatórios'},400);
  if(!wmCompanyAllowed(b.company_id)) return json({error:'Fora do escopo'},403);
  const type=String(b.item_type||'TASK').toUpperCase();
  if(!wmAllowedTypes.includes(type)) return json({error:'Tipo inválido'},400);
  if(!wmAllowedStatuses.includes(b.status||'BACKLOG')) return json({error:'Status inválido'},400);
  if(!(await wmValidateParent(b.parent_id,b.company_id))) return json({error:'Item pai deve pertencer à mesma empresa'},400);
  if(!(await wmValidateSprint(b.sprint_id,b.company_id,b.project_id))) return json({error:'Sprint incompatível com empresa/projeto'},400);
  const id=b.id||await wmIssueId(type);
  const exists=await DB.prepare('SELECT id FROM issues WHERE id=?').bind(id).first(); if(exists)return json({error:'ID já existe'},409);
  await DB.prepare(`INSERT INTO issues (id,title,project,project_id,company_id,status,priority,owner,due_date,flag,flag_type,item_type,parent_id,description,acceptance_criteria,story_points,estimate_hours,sprint_id,rank,labels,blocked,blocked_reason,source,reporter,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'),?,?)`)
    .bind(id,b.title,b.project||'',b.project_id||null,b.company_id,b.status||'BACKLOG',b.priority||'Média',b.owner||'',b.due_date||null,b.flag||'',b.flag_type||'',type,b.parent_id||null,b.description||'',b.acceptance_criteria||'',b.story_points??null,b.estimate_hours??null,b.sprint_id||null,b.rank??Date.now(),JSON.stringify(b.labels||[]),b.blocked?1:0,b.blocked_reason||'',b.source||'allamo',b.reporter||user.name,user.name,user.name).run();
  await wmEmit(b.company_id,b.project_id,id,'work_item','created',{type});
  await logEvent(env,user,'work-item:criar',id,b.title);
  return json({ok:true,id},201);
}

// WORK ITEMS — DETALHE
if (path.match(/^work-items\/[^/]+$/) && request.method === 'GET') {
  const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id);
  if(!item) return json({error:'Item não encontrado'},404);
  if(!wmCompanyAllowed(item.company_id)) return json({error:'Fora do escopo'},403);
  const [comments,checklist,links]=await Promise.all([
    DB.prepare('SELECT * FROM issue_comments WHERE issue_id=? AND deleted_at IS NULL ORDER BY id').bind(id).all(),
    DB.prepare('SELECT * FROM issue_checklist WHERE issue_id=? AND deleted_at IS NULL ORDER BY rank,id').bind(id).all(),
    DB.prepare('SELECT * FROM issue_links WHERE source_issue_id=? OR target_issue_id=? ORDER BY id').bind(id,id).all()
  ]);
  return json({...item,comments:comments.results,checklist:checklist.results,links:links.results});
}

// WORK ITEMS — EDITAR
if (path.match(/^work-items\/[^/]+$/) && (request.method === 'PUT' || request.method === 'PATCH')) {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const id=decodeURIComponent(path.split('/')[1]); const old=await wmGetIssue(id);
  if(!old) return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(old.company_id)) return json({error:'Fora do escopo'},403);
  const b=await request.json();
  if(b.item_type && !wmAllowedTypes.includes(String(b.item_type).toUpperCase()))return json({error:'Tipo inválido'},400);
  if(b.status && !wmAllowedStatuses.includes(b.status))return json({error:'Status inválido'},400);
  if(Object.prototype.hasOwnProperty.call(b,'parent_id') && !(await wmValidateParent(b.parent_id,old.company_id)))return json({error:'Item pai inválido'},400);
  const effectiveProject=Object.prototype.hasOwnProperty.call(b,'project_id')?b.project_id:old.project_id;
  if(Object.prototype.hasOwnProperty.call(b,'sprint_id') && !(await wmValidateSprint(b.sprint_id,old.company_id,effectiveProject)))return json({error:'Sprint incompatível'},400);
  const fields=['title','project','project_id','status','priority','owner','due_date','start_date','item_type','parent_id','description','acceptance_criteria','story_points','estimate_hours','sprint_id','release_id','rank','blocked','blocked_reason','reporter'];
  const sets=[]; const args=[];
  for(const f of fields){if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='blocked'?(b[f]?1:0):(f==='item_type'?String(b[f]).toUpperCase():b[f]));}}
  if(Object.prototype.hasOwnProperty.call(b,'labels')){sets.push('labels=?');args.push(JSON.stringify(b.labels||[]));}
  if(!sets.length) return json({ok:true,id});
  sets.push("updated_at=datetime('now')","updated_by=?"); args.push(user.name,id);
  await DB.prepare('UPDATE issues SET '+sets.join(',')+' WHERE id=?').bind(...args).run();
  await wmEmit(old.company_id,effectiveProject,id,'work_item','updated',{fields:Object.keys(b)});
  await logEvent(env,user,'work-item:editar',id,Object.keys(b).join(','));
  return json({ok:true,id});
}

// WORK ITEMS — ARQUIVAR (exclusão lógica)
if (path.match(/^work-items\/[^/]+$/) && request.method === 'DELETE') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id);
  if(!item)return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);
  await DB.prepare("UPDATE issues SET archived_at=datetime('now'), updated_at=datetime('now'), updated_by=? WHERE id=?").bind(user.name,id).run();
  await wmEmit(item.company_id,item.project_id,id,'work_item','archived',{}); await logEvent(env,user,'work-item:arquivar',id,item.title);
  return json({ok:true,id});
}

// TRANSIÇÃO KANBAN
if (path.match(/^work-items\/[^/]+\/transition$/) && request.method === 'POST') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id); if(!item)return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json(); if(!wmAllowedStatuses.includes(b.status))return json({error:'Status inválido'},400);
  await DB.prepare("UPDATE issues SET status=?, rank=COALESCE(?,rank), updated_at=datetime('now'), updated_by=? WHERE id=?").bind(b.status,b.rank??null,user.name,id).run();
  await wmEmit(item.company_id,item.project_id,id,'workflow','status_changed',{from:item.status,to:b.status}); await logEvent(env,user,'work-item:transição',id,item.status+' → '+b.status);
  return json({ok:true,id,status:b.status});
}

// RANKING DO BACKLOG
if (path === 'work-rank' && request.method === 'POST') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403); const b=await request.json(); if(!Array.isArray(b.items))return json({error:'items deve ser lista'},400);
  for(const x of b.items){const i=await wmGetIssue(x.id);if(!i||!wmCompanyAllowed(i.company_id))return json({error:'Item inválido ou fora do escopo'},403);await DB.prepare("UPDATE issues SET rank=?,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(x.rank,user.name,x.id).run();}
  return json({ok:true,count:b.items.length});
}

// COMENTÁRIOS
if (path.match(/^work-items\/[^/]+\/comments$/) && request.method === 'GET') {
  const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id);if(!item)return json({error:'Item não encontrado'},404);if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);
  return json((await DB.prepare('SELECT * FROM issue_comments WHERE issue_id=? AND deleted_at IS NULL ORDER BY id').bind(id).all()).results);
}
if (path.match(/^work-items\/[^/]+\/comments$/) && request.method === 'POST') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403); const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id);if(!item)return json({error:'Item não encontrado'},404);if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json();if(!String(b.body||'').trim())return json({error:'Comentário vazio'},400);const r=await DB.prepare("INSERT INTO issue_comments(company_id,issue_id,author,body,created_at) VALUES (?,?,?,?,datetime('now'))").bind(item.company_id,id,user.name,String(b.body).trim()).run();await logEvent(env,user,'work-item:comentário',id,'Comentário adicionado');return json({ok:true,id:r.meta?.last_row_id},201);
}
if (path.match(/^work-comments\/\d+$/) && request.method === 'DELETE') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403);const cid=Number(path.split('/')[1]);const c=await DB.prepare('SELECT * FROM issue_comments WHERE id=?').bind(cid).first();if(!c)return json({error:'Comentário não encontrado'},404);if(!wmCompanyAllowed(c.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE issue_comments SET deleted_at=datetime('now') WHERE id=?").bind(cid).run();return json({ok:true});
}

// CHECKLIST
if (path.match(/^work-items\/[^/]+\/checklist$/) && request.method === 'POST') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]);const item=await wmGetIssue(id);if(!item)return json({error:'Item não encontrado'},404);if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();if(!String(b.text||'').trim())return json({error:'Texto obrigatório'},400);const r=await DB.prepare("INSERT INTO issue_checklist(company_id,issue_id,text,done,rank,created_by,created_at) VALUES (?,?,?,0,?,?,datetime('now'))").bind(item.company_id,id,String(b.text).trim(),b.rank??Date.now(),user.name).run();return json({ok:true,id:r.meta?.last_row_id},201);
}
if (path.match(/^work-checklist\/\d+$/) && (request.method==='PATCH'||request.method==='PUT')) {
  if(!wmCanWrite)return json({error:'Sem permissão'},403);const cid=Number(path.split('/')[1]);const c=await DB.prepare('SELECT * FROM issue_checklist WHERE id=? AND deleted_at IS NULL').bind(cid).first();if(!c)return json({error:'Checklist não encontrado'},404);if(!wmCompanyAllowed(c.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();await DB.prepare("UPDATE issue_checklist SET text=COALESCE(?,text),done=COALESCE(?,done),rank=COALESCE(?,rank),updated_at=datetime('now') WHERE id=?").bind(b.text??null,Object.prototype.hasOwnProperty.call(b,'done')?(b.done?1:0):null,b.rank??null,cid).run();return json({ok:true});
}
if (path.match(/^work-checklist\/\d+$/) && request.method==='DELETE') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403);const cid=Number(path.split('/')[1]);const c=await DB.prepare('SELECT * FROM issue_checklist WHERE id=?').bind(cid).first();if(!c)return json({error:'Checklist não encontrado'},404);if(!wmCompanyAllowed(c.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE issue_checklist SET deleted_at=datetime('now') WHERE id=?").bind(cid).run();return json({ok:true});
}

// LINKS / DEPENDÊNCIAS
if (path.match(/^work-items\/[^/]+\/links$/) && request.method==='POST') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]);const source=await wmGetIssue(id);if(!source)return json({error:'Item não encontrado'},404);if(!wmCompanyAllowed(source.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();const target=await wmGetIssue(b.target_issue_id);if(!target||target.company_id!==source.company_id)return json({error:'Destino inválido'},400);if(!wmAllowedLinks.includes(b.link_type))return json({error:'Tipo de vínculo inválido'},400);const r=await DB.prepare("INSERT INTO issue_links(company_id,source_issue_id,target_issue_id,link_type,created_by,created_at) VALUES (?,?,?,?,?,datetime('now'))").bind(source.company_id,id,target.id,b.link_type,user.name).run();return json({ok:true,id:r.meta?.last_row_id},201);
}
if (path.match(/^work-links\/\d+$/) && request.method==='DELETE') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403);const lid=Number(path.split('/')[1]);const l=await DB.prepare('SELECT * FROM issue_links WHERE id=?').bind(lid).first();if(!l)return json({error:'Vínculo não encontrado'},404);if(!wmCompanyAllowed(l.company_id))return json({error:'Fora do escopo'},403);await DB.prepare('DELETE FROM issue_links WHERE id=?').bind(lid).run();return json({ok:true});
}

// SPRINTS
if (path === 'sprints' && request.method === 'GET') {
  const clauses=[];const args=[];if(scope){clauses.push('company_id=?');args.push(scope);}const project=url.searchParams.get('project_id');if(project){clauses.push('project_id=?');args.push(project);}return json((await DB.prepare('SELECT * FROM sprints'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY COALESCE(start_date,created_at) DESC,id DESC').bind(...args).all()).results);
}
if (path === 'sprints' && request.method === 'POST') {
  if(!wmCanManageSprint)return json({error:'Sem permissão'},403);const b=await request.json();if(!b.name||!b.company_id)return json({error:'Nome e empresa são obrigatórios'},400);if(!wmCompanyAllowed(b.company_id))return json({error:'Fora do escopo'},403);const id=crypto.randomUUID();await DB.prepare("INSERT INTO sprints(id,company_id,project_id,name,goal,status,start_date,end_date,capacity_points,capacity_hours,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'PLANEJADA',?,?,?,?,?,datetime('now'),datetime('now'))").bind(id,b.company_id,b.project_id||null,b.name,b.goal||'',b.start_date||null,b.end_date||null,b.capacity_points??null,b.capacity_hours??null,user.name).run();await wmEmit(b.company_id,b.project_id,null,'sprint','created',{sprint_id:id});await logEvent(env,user,'sprint:criar',id,b.name);return json({ok:true,id},201);
}
if (path.match(/^sprints\/[^/]+$/) && (request.method==='PATCH'||request.method==='PUT')) {
  if(!wmCanManageSprint)return json({error:'Sem permissão'},403);const id=path.split('/')[1];const s=await wmGetSprint(id);if(!s)return json({error:'Sprint não encontrada'},404);if(!wmCompanyAllowed(s.company_id))return json({error:'Fora do escopo'},403);if(!['PLANEJADA','ATIVA'].includes(s.status))return json({error:'Sprint encerrada não pode ser editada'},409);const b=await request.json();const fields=['name','goal','start_date','end_date','capacity_points','capacity_hours'];const sets=[];const args=[];for(const f of fields){if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f]);}}if(!sets.length)return json({ok:true,id});sets.push("updated_at=datetime('now')");args.push(id);await DB.prepare('UPDATE sprints SET '+sets.join(',')+' WHERE id=?').bind(...args).run();return json({ok:true,id});
}
if (path.match(/^sprints\/[^/]+\/(start|complete|cancel)$/) && request.method === 'POST') {
  if(!wmCanManageSprint)return json({error:'Sem permissão'},403);const [,id,action]=path.split('/');const s=await wmGetSprint(id);if(!s)return json({error:'Sprint não encontrada'},404);if(!wmCompanyAllowed(s.company_id))return json({error:'Fora do escopo'},403);const b=await request.json().catch(()=>({}));
  if(action==='start') {if(s.status!=='PLANEJADA')return json({error:'Somente sprint planejada pode iniciar'},409);await DB.prepare("UPDATE sprints SET status='ATIVA',started_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(id).run();}
  if(action==='complete') {if(s.status!=='ATIVA')return json({error:'Somente sprint ativa pode concluir'},409);const incomplete=await DB.prepare("SELECT id FROM issues WHERE sprint_id=? AND archived_at IS NULL AND status NOT IN ('CONCLUÍDO','CANCELADO')").bind(id).all();if(incomplete.results.length){if(!b.destination)return json({error:'Há itens incompletos. Informe destination: backlog ou sprint_id.',incomplete:incomplete.results.map(x=>x.id)},409);if(b.destination==='backlog')await DB.prepare("UPDATE issues SET sprint_id=NULL,status=CASE WHEN status='CONCLUÍDO' THEN status ELSE 'BACKLOG' END,updated_at=datetime('now') WHERE sprint_id=? AND status NOT IN ('CONCLUÍDO','CANCELADO')").bind(id).run();else{const dest=await wmGetSprint(b.destination);if(!dest||dest.company_id!==s.company_id)return json({error:'Sprint destino inválida'},400);await DB.prepare("UPDATE issues SET sprint_id=?,updated_at=datetime('now') WHERE sprint_id=? AND status NOT IN ('CONCLUÍDO','CANCELADO')").bind(dest.id,id).run();}}await DB.prepare("UPDATE sprints SET status='CONCLUÍDA',completed_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(id).run();}
  if(action==='cancel') {if(['CONCLUÍDA','CANCELADA'].includes(s.status))return json({error:'Sprint já encerrada'},409);await DB.prepare("UPDATE issues SET sprint_id=NULL,status=CASE WHEN status='CONCLUÍDO' THEN status ELSE 'BACKLOG' END,updated_at=datetime('now') WHERE sprint_id=?").bind(id).run();await DB.prepare("UPDATE sprints SET status='CANCELADA',cancelled_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(id).run();}
  const status=action==='start'?'ATIVA':action==='complete'?'CONCLUÍDA':'CANCELADA';await wmEmit(s.company_id,s.project_id,null,'sprint',action,{sprint_id:id});await logEvent(env,user,'sprint:'+action,id,s.name);return json({ok:true,id,status});
}

// TELEMETRIA / ANALYTICS
if (path === 'work-events' && request.method === 'POST') {
  const b=await request.json();const companyId=scope||b.company_id;if(!companyId)return json({error:'Empresa obrigatória'},400);if(!wmCompanyAllowed(companyId))return json({error:'Fora do escopo'},403);await DB.prepare("INSERT INTO work_events(company_id,project_id,issue_id,event_type,event_name,actor,session_id,screen,element,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))").bind(companyId,b.project_id||null,b.issue_id||null,b.event_type||'usage',b.event_name||'event',user.name,b.session_id||'',b.screen||'',b.element||'',JSON.stringify(b.metadata||{})).run();return json({ok:true},201);
}
if (path === 'work-analytics' && request.method === 'GET') {
  const clauses=['archived_at IS NULL'];const args=[];if(scope){clauses.push('company_id=?');args.push(scope);}const project=url.searchParams.get('project_id');if(project){clauses.push('project_id=?');args.push(project);}const wi=' WHERE '+clauses.join(' AND ');const eventClauses=[];const eventArgs=[];if(scope){eventClauses.push('company_id=?');eventArgs.push(scope);}if(project){eventClauses.push('project_id=?');eventArgs.push(project);}const we=eventClauses.length?' WHERE '+eventClauses.join(' AND '):'';const byStatus=await DB.prepare('SELECT status,COUNT(*) total FROM issues'+wi+' GROUP BY status').bind(...args).all();const byType=await DB.prepare('SELECT item_type,COUNT(*) total FROM issues'+wi+' GROUP BY item_type').bind(...args).all();const events=await DB.prepare('SELECT event_name,COUNT(*) total FROM work_events'+we+' GROUP BY event_name ORDER BY total DESC LIMIT 30').bind(...eventArgs).all();return json({byStatus:byStatus.results,byType:byType.results,events:events.results});
}
