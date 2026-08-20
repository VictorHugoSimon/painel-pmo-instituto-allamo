// Államo Work Management — bloco de rotas para injeção em public/_worker.js
// Usa as variáveis existentes: path, request, DB, user, scope, env, json, logEvent.
// O build injeta este conteúdo dentro de handleApi, após autenticação/escopo.

const wmCanWrite = ['admin','pmo','gestor','techlead'].includes(user.role);
const wmCanManageSprint = ['admin','pmo','techlead'].includes(user.role);
const wmCompanyAllowed = (companyId) => !scope || companyId === scope;
const wmIssueId = async (type='TASK') => {
  const prefix = ({EPIC:'EPIC',FEATURE:'FEAT',STORY:'STORY',TASK:'TASK',SUBTASK:'SUB',BUG:'BUG',INCIDENT:'INC',IMPROVEMENT:'IMP',ACTION:'ACT',REQUIREMENT:'REQ',MILESTONE:'MS'})[String(type).toUpperCase()] || 'TASK';
  const row = await DB.prepare('SELECT COUNT(*) n FROM issues').first();
  return 'ALL-' + prefix + '-' + String((row?.n||0)+1).padStart(4,'0');
};
const wmGetIssue = async id => DB.prepare('SELECT * FROM issues WHERE id=?').bind(id).first();

if (path === 'work-items' && request.method === 'GET') {
  const clauses=[]; const args=[];
  if (scope) { clauses.push('company_id=?'); args.push(scope); }
  for (const [param,col] of [['project','project'],['status','status'],['type','item_type'],['sprint','sprint_id'],['owner','owner'],['priority','priority']]) {
    const v=url.searchParams.get(param); if(v){ clauses.push(col+'=?'); args.push(v); }
  }
  const q=url.searchParams.get('q'); if(q){ clauses.push('(title LIKE ? OR description LIKE ?)'); args.push('%'+q+'%','%'+q+'%'); }
  const sql='SELECT * FROM issues'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY rank ASC, updated_at DESC, id DESC';
  return json((await DB.prepare(sql).bind(...args).all()).results);
}
if (path === 'work-items' && request.method === 'POST') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const b=await request.json();
  if(!b.title||!b.company_id) return json({error:'Título e empresa são obrigatórios'},400);
  if(!wmCompanyAllowed(b.company_id)) return json({error:'Fora do escopo'},403);
  const id=b.id||await wmIssueId(b.item_type);
  await DB.prepare(`INSERT INTO issues (id,title,project,project_id,company_id,status,priority,owner,due_date,flag,flag_type,item_type,parent_id,description,acceptance_criteria,story_points,estimate_hours,sprint_id,rank,labels,blocked,blocked_reason,source,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'),?,?)`)
    .bind(id,b.title,b.project||'',b.project_id||null,b.company_id,b.status||'BACKLOG',b.priority||'Média',b.owner||'',b.due_date||null,b.flag||'',b.flag_type||'',String(b.item_type||'TASK').toUpperCase(),b.parent_id||null,b.description||'',b.acceptance_criteria||'',b.story_points??null,b.estimate_hours??null,b.sprint_id||null,b.rank??Date.now(),JSON.stringify(b.labels||[]),b.blocked?1:0,b.blocked_reason||'',b.source||'allamo',user.name,user.name).run();
  await logEvent(env,user,'work-item:criar',id,b.title);
  return json({ok:true,id},201);
}
if (path.startsWith('work-items/') && request.method === 'GET') {
  const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id);
  if(!item) return json({error:'Item não encontrado'},404);
  if(!wmCompanyAllowed(item.company_id)) return json({error:'Fora do escopo'},403);
  const [comments,checklist,links]=await Promise.all([
    DB.prepare('SELECT * FROM issue_comments WHERE issue_id=? ORDER BY id').bind(id).all(),
    DB.prepare('SELECT * FROM issue_checklist WHERE issue_id=? ORDER BY rank,id').bind(id).all(),
    DB.prepare('SELECT * FROM issue_links WHERE source_issue_id=? OR target_issue_id=? ORDER BY id').bind(id,id).all()
  ]);
  return json({...item,comments:comments.results,checklist:checklist.results,links:links.results});
}
if (path.startsWith('work-items/') && request.method === 'PUT') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const id=decodeURIComponent(path.split('/')[1]); const old=await wmGetIssue(id);
  if(!old) return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(old.company_id)) return json({error:'Fora do escopo'},403);
  const b=await request.json();
  const fields=['title','project','project_id','status','priority','owner','due_date','item_type','parent_id','description','acceptance_criteria','story_points','estimate_hours','sprint_id','rank','blocked','blocked_reason'];
  const sets=[]; const args=[]; for(const f of fields){if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='blocked'?(b[f]?1:0):b[f]);}}
  if(Object.prototype.hasOwnProperty.call(b,'labels')){sets.push('labels=?');args.push(JSON.stringify(b.labels||[]));}
  if(!sets.length) return json({ok:true,id}); sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);
  await DB.prepare('UPDATE issues SET '+sets.join(',')+' WHERE id=?').bind(...args).run();
  await logEvent(env,user,'work-item:editar',id,JSON.stringify(b).slice(0,700)); return json({ok:true,id});
}
if (path.match(/^work-items\/[^/]+\/transition$/) && request.method === 'POST') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403);
  const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id); if(!item)return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json(); const allowed=['BACKLOG','A FAZER','EM ANDAMENTO','CODE REVIEW','QA','HOMOLOGAÇÃO','CONCLUÍDO','CANCELADO'];
  if(!allowed.includes(b.status))return json({error:'Status inválido'},400);
  await DB.prepare("UPDATE issues SET status=?, rank=COALESCE(?,rank), updated_at=datetime('now'), updated_by=? WHERE id=?").bind(b.status,b.rank??null,user.name,id).run();
  await DB.prepare("INSERT INTO work_events(company_id,project_id,issue_id,event_type,event_name,actor,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))").bind(item.company_id,item.project_id||null,id,'workflow','status_changed',user.name,JSON.stringify({from:item.status,to:b.status})).run();
  await logEvent(env,user,'work-item:transição',id,item.status+' → '+b.status); return json({ok:true,id,status:b.status});
}
if (path.match(/^work-items\/[^/]+\/comment$/) && request.method === 'POST') {
  if(!wmCanWrite) return json({error:'Sem permissão'},403); const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id); if(!item)return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json(); if(!b.body)return json({error:'Comentário vazio'},400); await DB.prepare("INSERT INTO issue_comments(issue_id,author,body,created_at) VALUES (?,?,?,datetime('now'))").bind(id,user.name,b.body).run(); await logEvent(env,user,'work-item:comentário',id,b.body.slice(0,250)); return json({ok:true},201);
}
if (path.match(/^work-items\/[^/]+\/checklist$/) && request.method === 'POST') {
  if(!wmCanWrite)return json({error:'Sem permissão'},403); const id=decodeURIComponent(path.split('/')[1]); const item=await wmGetIssue(id); if(!item)return json({error:'Item não encontrado'},404); if(!wmCompanyAllowed(item.company_id))return json({error:'Fora do escopo'},403); const b=await request.json(); if(!b.text)return json({error:'Texto obrigatório'},400); await DB.prepare('INSERT INTO issue_checklist(issue_id,text,done,rank,created_by) VALUES (?,?,0,?,?)').bind(id,b.text,b.rank??Date.now(),user.name).run(); return json({ok:true},201);
}
if (path === 'sprints' && request.method === 'GET') {
  const clauses=[];const args=[];if(scope){clauses.push('company_id=?');args.push(scope);}const project=url.searchParams.get('project');if(project){clauses.push('project_id=?');args.push(project);}return json((await DB.prepare('SELECT * FROM sprints'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY start_date DESC,id DESC').bind(...args).all()).results);
}
if (path === 'sprints' && request.method === 'POST') {
  if(!wmCanManageSprint)return json({error:'Sem permissão'},403);const b=await request.json();if(!b.name||!b.company_id)return json({error:'Nome e empresa são obrigatórios'},400);if(!wmCompanyAllowed(b.company_id))return json({error:'Fora do escopo'},403);const id=crypto.randomUUID();await DB.prepare("INSERT INTO sprints(id,company_id,project_id,name,goal,status,start_date,end_date,capacity_points,capacity_hours,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'PLANEJADA',?,?,?,?,?,datetime('now'),datetime('now'))").bind(id,b.company_id,b.project_id||null,b.name,b.goal||'',b.start_date||null,b.end_date||null,b.capacity_points??null,b.capacity_hours??null,user.name).run();await logEvent(env,user,'sprint:criar',id,b.name);return json({ok:true,id},201);
}
if (path.match(/^sprints\/[^/]+\/(start|complete)$/) && request.method === 'POST') {
  if(!wmCanManageSprint)return json({error:'Sem permissão'},403);const [,id,action]=path.split('/');const s=await DB.prepare('SELECT * FROM sprints WHERE id=?').bind(id).first();if(!s)return json({error:'Sprint não encontrada'},404);if(!wmCompanyAllowed(s.company_id))return json({error:'Fora do escopo'},403);const status=action==='start'?'ATIVA':'CONCLUÍDA';if(action==='start')await DB.prepare("UPDATE sprints SET status='ATIVA',started_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(id).run();else await DB.prepare("UPDATE sprints SET status='CONCLUÍDA',completed_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(id).run();await logEvent(env,user,'sprint:'+action,id,s.name);return json({ok:true,id,status});
}
if (path === 'work-events' && request.method === 'POST') {
  const b=await request.json(); const companyId=scope||b.company_id; if(!companyId)return json({error:'Empresa obrigatória'},400);if(!wmCompanyAllowed(companyId))return json({error:'Fora do escopo'},403);await DB.prepare("INSERT INTO work_events(company_id,project_id,issue_id,event_type,event_name,actor,session_id,screen,element,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))").bind(companyId,b.project_id||null,b.issue_id||null,b.event_type||'usage',b.event_name||'event',user.name,b.session_id||'',b.screen||'',b.element||'',JSON.stringify(b.metadata||{})).run();return json({ok:true},201);
}
if (path === 'work-analytics' && request.method === 'GET') {
  const clauses=[];const args=[];if(scope){clauses.push('company_id=?');args.push(scope);}const project=url.searchParams.get('project');if(project){clauses.push('project_id=?');args.push(project);}const w=clauses.length?' WHERE '+clauses.join(' AND '):'';const byStatus=await DB.prepare('SELECT status,COUNT(*) total FROM issues'+w+' GROUP BY status').bind(...args).all();const byType=await DB.prepare('SELECT item_type,COUNT(*) total FROM issues'+w+' GROUP BY item_type').bind(...args).all();const events=await DB.prepare('SELECT event_name,COUNT(*) total FROM work_events'+w+' GROUP BY event_name ORDER BY total DESC LIMIT 30').bind(...args).all();return json({byStatus:byStatus.results,byType:byType.results,events:events.results});
}
