// _worker.js — Portal PMO Allamo (Cloudflare Pages Advanced Mode)
// Um único arquivo (nome sem colchetes) roteia /api/* e serve o site.
// Binding D1 "DB" e Workers AI "AI".

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// Modelo padrão do Status Report (provisionado por projeto)
function defaultReport(co) {
  const prog = co && co.progress != null ? co.progress : 0;
  const semColor = { g:'#0ca30c', a:'#e0951a', r:'#d03b3b', s:'#898781' };
  const sc = semColor[co ? co.status : 's'] || '#898781';
  const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const now = new Date();
  const ref = MESES[now.getUTCMonth()] + '/' + String(now.getUTCFullYear()).slice(2);
  return {
    title: 'Governança da Implantação · ' + (co ? co.name : 'Projeto'),
    client: co ? co.name : '—', ref,
    pillars: [
      { num:'1', name:'Governança da Implantação ERP', desc:'PMO e apoio estratégico para a implantação alinhada a processos, pessoas e objetivos.', tag:'Rumo certo, execução segura' },
      { num:'2', name:'Estruturação Gerencial e Operacional', desc:'Organização, processos e responsabilidades claras para uma gestão profissional.', tag:'Processos fortes, equipes alinhadas' },
      { num:'3', name:'Estruturação Financeira e Inteligência Gerencial', desc:'Visão financeira integrada e análise estratégica para dar segurança às decisões.', tag:'Decisões seguras, crescimento sustentável' },
      { num:'4', name:'Indicadores e Evolução Analítica', desc:'Indicadores e dashboards para acompanhar a performance e transformar dados em decisão.', tag:'Dados que geram resultados' }
    ],
    semaphores: [
      { label:'Prazo & Avanço', color: prog>=70?semColor.g:(prog>=40?semColor.a:sc), state: prog>=70?'No ritmo':(prog>=40?'Atenção':'Monitorar'), desc: prog+'% de avanço estimado.' },
      { label:'Escopo', color: semColor.a, state:'Em andamento', desc: (co && co.summary) ? co.summary : 'Escopo em execução conforme plano.' },
      { label:'Situação PMO', color: sc, state: co ? co.status_text : 'A reconciliar', desc:'Leitura do responsável PMO ('+(co ? co.lead : '—')+').' }
    ],
    kpis: [
      { label:'Avanço do projeto', value:String(prog), unit:'%', note:'estimativa PMO', pct:prog+'%' },
      { label:'Fases concluídas', value:'2', unit:' / 5', note:'preparação + diagnóstico', pct:'40%' },
      { label:'Módulos mapeados', value:'7', unit:' / 7', note:'blueprint AS-IS/TO-BE', pct:'100%' },
      { label:'Pilar em execução', value:'1', unit:' / 4', note:'governança da implantação', pct:'25%' }
    ],
    phases: [
      { title:'Fase 1 · Preparação e Planejamento', pct:'4 de 4', items:[
        { name:'Plano de Projeto', tag:'ok' }, { name:'EAP e Cronograma', tag:'ok' }, { name:'Blueprint AS-IS/TO-BE', tag:'ok' }, { name:'Workshops por módulo', tag:'ok' } ] },
      { title:'Fase 2 · Diagnóstico e Desenho', pct:'2 de 5', items:[
        { name:'Aceite das especificações funcionais', tag:'ok' }, { name:'Orçamento de customizações', tag:'ok' }, { name:'Cronograma de implantação', tag:'run' }, { name:'Matriz RACI', tag:'dev' }, { name:'Plano de Riscos', tag:'dev' } ] }
    ],
    hourKpis: [
      { label:'Horas consumidas', value:'0', unit:'h', note:'no ciclo', pct:'0%', barColor:'#2a78d6' },
      { label:'Aderência ao plano', value:'—', unit:'', note:'real × previsto', pct:'0%', barColor:'#2a78d6' },
      { label:'Saldo de horas', value:'—', unit:'h', note:'disponível', pct:'100%', barColor:'#b88b78' },
      { label:'Tempo decorrido', value:'0', unit:' / 12m', note:'início do contrato', pct:'0%', barColor:'#2a78d6' }
    ],
    hoursMeta: 38,
    hoursBars: [],
    risks: [
      { color:'#e0951a', title:'Governança a formalizar', desc:'Matriz RACI e Plano de Riscos ainda a formalizar.', meta:'Ação Államo' }
    ],
    next: [
      { i:'1', title:'Definir donos de processo', desc:'Nomear key-users por área.' },
      { i:'2', title:'Formalizar a Fase 1', desc:'Submeter Matriz RACI e Plano de Riscos.' }
    ],
    tap: {
      version: '1.0', kickoff: '', type: 'Implantação ERP', elaboradoPor: (co?co.lead:'A definir'), cliente: (co?co.name:''),
      objetivo_doc: 'Formalizar a abertura do projeto, alinhando objetivos, escopo, marcos, partes interessadas e riscos entre Instituto Államo e o cliente.',
      situacao: 'Descreva a situação atual e a justificativa que motiva o projeto.',
      objetivo_geral: 'Objetivo geral do projeto.',
      objetivos_especificos: ['Objetivo específico 1', 'Objetivo específico 2'],
      marcos: [ { fase:'Blueprint & Planejamento', data:'A definir' }, { fase:'Parametrização & Validação', data:'A definir' }, { fase:'Go-Live', data:'A definir' } ],
      stakeholders: [ { nome:(co?co.lead:'A definir'), papel:'Responsável PMO (Államo)' }, { nome:'A definir', papel:'Sponsor (Cliente)' } ],
      restricoes: ['Prazo e janela de operação do cliente', 'Disponibilidade de key-users'],
      fatores_sucesso: ['Engajamento da liderança', 'Dados de migração íntegros', 'Validações no prazo'],
      riscos_tap: [ { risco:'Atraso nas validações', mitig:'Cadência semanal e donos definidos' } ],
      equipe: [ { nome:(co?co.lead:'A definir'), funcao:'Consultor PMO' }, { nome:'A definir', funcao:'Techlead' } ]
    }
  };
}

async function logEvent(env, user, action, target, detail) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (ts, actor, role, company_id, action, target, detail) VALUES (datetime('now'),?,?,?,?,?,?)"
    ).bind(user ? user.name : 'sistema', user ? user.role : '-', user ? user.company_id : null, action, target || '', detail || '').run();
  } catch (e) { /* nunca quebra a operação principal por causa do log */ }
}

async function currentUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const s = await env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')"
  ).bind(token).first();
  return s || null;
}
function scopeCompany(user, requested) {
  if (user.role === 'gestor' || user.role === 'usuario') return user.company_id;
  return requested && requested !== 'all' ? requested : null;
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api\/?/, '');
  const DB = env.DB;
  try {
    if (path === 'login' && request.method === 'POST') {
      const { email, password } = await request.json();
      const user = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user || user.status === 'Bloqueado') return json({ error: 'Credenciais inválidas' }, 401);
      const hash = await sha(password + ':' + email);
      if (user.password_hash !== hash) return json({ error: 'Credenciais inválidas' }, 401);
      const token = crypto.randomUUID();
      await DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now','+12 hours'))").bind(token, user.id).run();
      await logEvent(env, user, 'login', 'sessão', 'Entrou no portal');
      return json({ token, user: { name: user.name, role: user.role, company_id: user.company_id } });
    }

    const user = await currentUser(request, env);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const scope = scopeCompany(user, url.searchParams.get('company'));
    const where = scope ? ' WHERE company_id = ?' : '';
    const bind = scope ? [scope] : [];

    // EMPRESAS: criar (rota dedicada)
    if ((path === 'company-create' || path === 'companies') && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name) return json({ error: 'Nome da empresa é obrigatório' }, 400);
      const id = (b.id || b.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').slice(0,32) || ('emp'+Date.now());
      const exists = await DB.prepare('SELECT id FROM companies WHERE id = ?').bind(id).first();
      if (exists) return json({ error: 'Já existe empresa com esse identificador' }, 409);
      await DB.prepare('INSERT INTO companies (id,name,city,system,own_system,lead,start_date,status,status_text,pmo_mode,progress,summary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id, b.name, b.city||'', b.system||'SallamoS', b.own_system?1:0, b.lead||'A definir', b.start_date||'', b.status||'s', b.status_text||'Em implantação', b.pmo_mode||'PMO Direto', b.progress!=null?b.progress:0, b.summary||'').run();
      await logEvent(env, user, 'empresa:criar', b.name, 'Nova empresa (' + id + ')');
      return json({ ok: true, id });
    }
    if (path === 'companies' && request.method === 'GET') {
      const sql = (user.role === 'gestor' || user.role === 'usuario')
        ? 'SELECT * FROM companies WHERE id = ?' : 'SELECT * FROM companies ORDER BY name';
      const r = await DB.prepare(sql).bind(...(scope ? [scope] : [])).all();
      return json(r.results);
    }
    if (path === 'projects' && request.method === 'GET')  return json((await DB.prepare('SELECT * FROM projects' + where).bind(...bind).all()).results);
    if (path === 'issues' && request.method === 'GET')    return json((await DB.prepare('SELECT * FROM issues' + where).bind(...bind).all()).results);
    if (path === 'releases' && request.method === 'GET')  return json((await DB.prepare('SELECT * FROM releases' + where + ' ORDER BY rel_date DESC').bind(...bind).all()).results);
    if (path === 'documents' && request.method === 'GET') return json((await DB.prepare('SELECT * FROM documents' + where).bind(...bind).all()).results);
    if (path === 'gmud' && request.method === 'GET') {
      const sql = 'SELECT * FROM gmud' + where + (scope && (user.role==='gestor'||user.role==='usuario') ? ' AND client_visible = 1' : '') + ' ORDER BY id DESC';
      return json((await DB.prepare(sql).bind(...bind).all()).results);
    }
    if (path === 'notifications' && request.method === 'GET') {
      const rows = await DB.prepare('SELECT * FROM notifications' + where + ' ORDER BY id DESC LIMIT 50').bind(...bind).all();
      return json(rows.results);
    }

    // GMUD: criar + notificar
    if (path === 'gmud' && request.method === 'POST') {
      if (!['admin','pmo','gestor','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.title || !b.company_id) return json({ error: 'Informe título e empresa' }, 400);
      if (scope && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      const seq = (await DB.prepare("SELECT COUNT(*) AS n FROM gmud").first()).n + 1;
      const id = 'GMUD-' + String(seq).padStart(3,'0');
      await DB.prepare("INSERT INTO gmud (id,title,company_id,project,type,risk,status,requester,approver,techlead,window_txt,affects,rollback,description,client_visible,pmo_ok,techlead_ok,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,datetime('now'))")
        .bind(id, b.title, b.company_id, b.project||'', b.type||'Normal', b.risk||'Médio', 'Solicitada', user.name, b.approver||'PMO', b.techlead||'Techlead', b.window_txt||'A definir', b.affects||'', b.rollback||'', b.description||'', b.client_visible===false?0:1).run();
      const co = await DB.prepare('SELECT name FROM companies WHERE id = ?').bind(b.company_id).first();
      await DB.prepare("INSERT INTO notifications (company_id,project,type,title,message,created_at) VALUES (?,?,?,?,?,datetime('now'))")
        .bind(b.company_id, b.project||'', 'gmud', 'Nova mudança: ' + b.title, 'Uma GMUD ('+id+') foi aberta para ' + (co?co.name:b.company_id) + ' e aguarda aprovação.').run();
      await logEvent(env, user, 'gmud:criar', id, b.title + ' → ' + (co?co.name:b.company_id));
      return json({ ok: true, id });
    }
    // GMUD: aprovação dupla / rejeição
    if (path.startsWith('gmud/') && request.method === 'POST') {
      const id = path.split('/')[1];
      const body = await request.json();
      const gate = body.gate || (user.role==='techlead' ? 'techlead' : 'pmo');
      const decision = body.decision || 'approve';
      const canGate = { pmo: ['admin','pmo'], techlead: ['admin','techlead'] };
      if (!(canGate[gate] || []).includes(user.role)) return json({ error: 'Sem permissão para o gate ' + gate }, 403);
      const g = await DB.prepare('SELECT * FROM gmud WHERE id = ?').bind(id).first();
      if (!g) return json({ error: 'GMUD não encontrada' }, 404);
      if (decision === 'reject') {
        await DB.prepare("UPDATE gmud SET status='Rejeitada', decided_by=?, decided_at=datetime('now') WHERE id=?").bind(user.name, id).run();
        await logEvent(env, user, 'gmud:rejeitar', id, g.title + ' (gate ' + gate + ')');
        return json({ ok: true, status: 'Rejeitada' });
      }
      const pmoOk = gate==='pmo' ? 1 : (g.pmo_ok||0);
      const tlOk = gate==='techlead' ? 1 : (g.techlead_ok||0);
      const status = (pmoOk && tlOk) ? 'Aprovada' : 'Em aprovação';
      await DB.prepare("UPDATE gmud SET pmo_ok=?, techlead_ok=?, status=?, decided_by=?, decided_at=datetime('now') WHERE id=?").bind(pmoOk, tlOk, status, user.name, id).run();
      await logEvent(env, user, 'gmud:aprovar', id, g.title + ' (gate ' + gate + (status==='Aprovada'?' · aprovada':'') + ')');
      return json({ ok: true, status, pmo_ok: pmoOk, techlead_ok: tlOk });
    }

    // PROJETOS: criar
    if (path === 'projects' && request.method === 'POST') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);
      if (scope && b.company_id && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      if (user.role === 'gestor') b.company_id = scope;
      const badgeMap = { 'Em andamento':'started', 'Backlog':'backlog', 'Completo':'completed', 'Cancelado':'canceled' };
      const r = await DB.prepare(
        'INSERT INTO projects (name,company_id,status,badge,urgency,summary,lead,start_date,meta_date,pmo_read,note,linear_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(b.name, b.company_id||null, b.status||'Backlog', badgeMap[b.status]||'backlog', b.urgency||'Média',
             b.summary||'', b.lead||'', b.start_date||'', b.meta_date||'', b.pmo_read||'Atenção', b.note||'', b.linear_url||'').run();
      await logEvent(env, user, 'projeto:criar', b.name, 'Novo projeto (' + (b.status||'Backlog') + ')');
      if (b.company_id) {
        const has = await DB.prepare('SELECT company_id FROM project_reports WHERE company_id = ?').bind(b.company_id).first();
        if (!has) {
          const co = await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(b.company_id).first();
          const def = defaultReport(co);
          await DB.prepare("INSERT INTO project_reports (company_id, ref, data_json, updated_at, updated_by) VALUES (?,?,?,datetime('now'),?)").bind(b.company_id, def.ref, JSON.stringify(def), user.name).run();
          await logEvent(env, user, 'report:provisionar', b.company_id, 'Área do projeto criada automaticamente');
        }
      }
      return json({ ok: true, id: r.meta && r.meta.last_row_id });
    }
    // PROJETOS: excluir
    if (path.startsWith('projects/') && request.method === 'DELETE') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const id = path.split('/')[1];
      const p = await DB.prepare('SELECT name, company_id FROM projects WHERE id = ?').bind(id).first();
      if (!p) return json({ error: 'Projeto não encontrado' }, 404);
      if (scope && p.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      await DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      await logEvent(env, user, 'projeto:excluir', p.name, 'Projeto removido');
      return json({ ok: true });
    }

    // USUARIOS: criar
    if (path === 'users' && request.method === 'POST') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name || !b.email || !b.password || !b.role) return json({ error: 'Preencha nome, e-mail, senha e perfil' }, 400);
      if (user.role !== 'admin' && !['gestor','usuario'].includes(b.role)) return json({ error: 'Você só pode criar acessos de cliente' }, 403);
      if (user.role === 'gestor') b.company_id = scope;
      const exists = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(b.email).first();
      if (exists) return json({ error: 'Já existe um usuário com esse e-mail' }, 409);
      const hash = await sha(b.password + ':' + b.email);
      const company = (b.role === 'gestor' || b.role === 'usuario') ? (b.company_id || null) : null;
      await DB.prepare('INSERT INTO users (name,email,password_hash,role,company_id,status) VALUES (?,?,?,?,?,?)').bind(b.name, b.email, hash, b.role, company, b.status || 'Ativo').run();
      await logEvent(env, user, 'usuario:criar', b.email, b.name + ' (' + b.role + ')');
      return json({ ok: true });
    }
    if (path === 'users' && request.method === 'GET') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      return json((await DB.prepare('SELECT id,name,email,role,company_id,status FROM users ORDER BY id').all()).results);
    }
    // USUARIO: editar
    if (path.startsWith('users/') && request.method === 'POST') {
      if (user.role !== 'admin') return json({ error: 'Sem permissão' }, 403);
      const email = decodeURIComponent(path.split('/')[1]);
      const b = await request.json();
      const u = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (!u) return json({ error: 'Usuário não encontrado' }, 404);
      const company = (b.role === 'gestor' || b.role === 'usuario') ? (b.company_id || null) : null;
      await DB.prepare('UPDATE users SET role=?, company_id=?, status=? WHERE email=?').bind(b.role, company, b.status || 'Ativo', email).run();
      await logEvent(env, user, 'usuario:editar', email, 'Perfil: ' + b.role + ' · ' + (b.status||'Ativo'));
      return json({ ok: true });
    }

    // HISTORICO
    if (path === 'audit') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const rows = await DB.prepare('SELECT ts,actor,role,company_id,action,target,detail FROM audit_log ORDER BY id DESC LIMIT 200').all();
      return json(rows.results);
    }

    // STATUS REPORT
    if (path === 'report') {
      const cid = scope || url.searchParams.get('company');
      if (!cid || cid === 'all') return json({ error: 'Informe a empresa' }, 400);
      const co = await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(cid).first();
      if (!co) return json({ error: 'Empresa não encontrada' }, 404);
      if (request.method === 'POST') {
        if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
        const body = await request.json();
        const data = body && body.data ? body.data : body;
        const ref = (data && data.ref) || defaultReport(co).ref;
        await DB.prepare("INSERT INTO project_reports (company_id, ref, data_json, updated_at, updated_by) VALUES (?,?,?,datetime('now'),?) ON CONFLICT(company_id) DO UPDATE SET ref=excluded.ref, data_json=excluded.data_json, updated_at=datetime('now'), updated_by=excluded.updated_by").bind(cid, ref, JSON.stringify(data), user.name).run();
        await logEvent(env, user, 'report:editar', cid, 'Status Report atualizado');
        return json({ ok: true });
      }
      const row = await DB.prepare('SELECT data_json, ref, updated_at, updated_by FROM project_reports WHERE company_id = ?').bind(cid).first();
      if (row && row.data_json) {
        let data; try { data = JSON.parse(row.data_json); } catch (e) { data = defaultReport(co); }
        return json({ data, meta: { ref: row.ref, updated_at: row.updated_at, updated_by: row.updated_by, provisioned: true } });
      }
      return json({ data: defaultReport(co), meta: { provisioned: false } });
    }

    // ASSISTENTE (Workers AI)
    if (path === 'chat' && request.method === 'POST') {
      const { message, history } = await request.json();
      if (!message) return json({ error: 'Mensagem vazia' }, 400);
      const cWhere = scope ? ' WHERE company_id = ?' : '';
      const cBind = scope ? [scope] : [];
      const companiesSql = (user.role === 'gestor' || user.role === 'usuario')
        ? 'SELECT id,name,city,status_text,pmo_mode,progress FROM companies WHERE id = ?'
        : 'SELECT id,name,city,status_text,pmo_mode,progress FROM companies';
      const [companies, projects, issues, gmud] = await Promise.all([
        DB.prepare(companiesSql).bind(...(scope ? [scope] : [])).all(),
        DB.prepare('SELECT name,company_id,status,pmo_read,note FROM projects' + cWhere).bind(...cBind).all(),
        DB.prepare('SELECT id,title,company_id,status,priority,owner,due_date,flag FROM issues' + cWhere).bind(...cBind).all(),
        DB.prepare('SELECT id,title,company_id,type,risk,status,approver FROM gmud' + cWhere).bind(...cBind).all()
      ]);
      const ctx = { empresas: companies.results, projetos: projects.results, demandas: issues.results, gmud: gmud.results };
      const system = [
        'Você é o assistente do Portal PMO do Instituto Államo.',
        'Responda SEMPRE em português do Brasil, de forma objetiva e cordial.',
        'Você ajuda com: status de projetos, demandas, GMUD (mudanças), viradas e uso do painel.',
        'Use APENAS os dados do contexto abaixo. Se não houver dado, diga que não encontrou. Nunca invente números.',
        'O usuário atual tem perfil "' + user.role + '"' + (scope ? ' e só enxerga a empresa "' + scope + '".' : ' e enxerga toda a carteira.'),
        'CONTEXTO (JSON): ' + JSON.stringify(ctx)
      ].join('\n');
      const msgs = [{ role: 'system', content: system }];
      if (Array.isArray(history)) for (const h of history.slice(-6)) if (h && h.role && h.content) msgs.push({ role: h.role, content: String(h.content).slice(0, 2000) });
      msgs.push({ role: 'user', content: String(message).slice(0, 2000) });
      try {
        const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/meta/llama-3.1-8b-instruct-fast','@cf/meta/llama-3.2-3b-instruct','@cf/meta/llama-3-8b-instruct'];
        let reply = '', lastErr = '';
        for (const model of models) {
          try { const ai = await env.AI.run(model, { messages: msgs, max_tokens: 640 }); reply = (ai && (ai.response || ai.result || '')) || ''; if (reply) break; }
          catch (e) { lastErr = String(e); }
        }
        if (!reply) return json({ error: 'IA indisponível: ' + lastErr }, 502);
        return json({ reply });
      } catch (e) { return json({ error: 'IA indisponível: ' + String(e) }, 502); }
    }

    return json({ error: 'Rota não encontrada' }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    // qualquer outra rota → serve os arquivos estáticos (o site)
    return env.ASSETS.fetch(request);
  }
};
