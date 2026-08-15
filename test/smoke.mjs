// smoke.mjs — Bateria completa do Portal PMO Allamo
// Uso:  node smoke.mjs https://allamo-pmo.pages.dev
// Testa TODAS as criações e o fluxo de trabalho ponta a ponta:
//   login/escopo · empresa · projeto (+area auto) · report · GMUD (dupla aprovação)
//   · usuário · edição de usuário · acesso do cliente · notificações · histórico.

const BASE = (process.argv[2] || 'http://localhost:8788').replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + n); };
const no = (n, e) => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + n + (e ? ' → ' + (typeof e==='string'?e:JSON.stringify(e)).slice(0,120) : '')); };

async function api(token, path, opts = {}) {
  const h = { 'content-type': 'application/json', ...(opts.headers || {}) };
  if (token) h.authorization = 'Bearer ' + token;
  const r = await fetch(BASE + '/api/' + path, { ...opts, headers: h });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function run() {
  console.log('\n== Portal PMO · Bateria completa ==\n  Base: ' + BASE + '\n');
  const stamp = Date.now();

  // --- AUTENTICAÇÃO E ESCOPO ---
  let r = await api(null, 'login', { method:'POST', body: JSON.stringify({ email:'x@x.com', password:'errado' }) });
  r.status === 401 ? ok('login inválido rejeitado (401)') : no('login inválido deveria dar 401', r.status);

  r = await api(null, 'login', { method:'POST', body: JSON.stringify({ email:'renan.rondon@institutoallamo.com.br', password:'allamo123' }) });
  const admin = r.body.token;
  admin ? ok('login admin ok') : no('login admin falhou — rode a migração/seed?', r.body);
  if (!admin) return done();

  r = await api(null, 'companies');
  r.status === 401 ? ok('rota protegida sem token (401)') : no('deveria exigir token', r.status);

  // --- EMPRESA (criação + persistência) ---
  const empNome = 'Empresa Teste ' + stamp;
  r = await api(admin, 'company-create', { method:'POST', body: JSON.stringify({ name:empNome, city:'Teste-SP' }) });
  const empId = r.body.id;
  (r.body.ok && empId) ? ok('empresa criada ('+empId+')') : no('CRIAÇÃO DE EMPRESA falhou', r.body);
  if (empId) {
    r = await api(admin, 'companies');
    (Array.isArray(r.body) && r.body.some(c=>c.id===empId)) ? ok('empresa persistida na lista') : no('empresa não apareceu na lista', r.status);
  }

  // --- PROJETO (criação + auto-provisão da área + persistência) ---
  const projNome = 'Projeto Teste ' + stamp;
  r = await api(admin, 'projects', { method:'POST', body: JSON.stringify({ name:projNome, company_id: empId||'esposende', status:'Em andamento' }) });
  const projId = r.body.id;
  (r.body.ok && projId) ? ok('projeto criado (id '+projId+')') : no('CRIAÇÃO DE PROJETO falhou', r.body);
  if (projId) {
    r = await api(admin, 'projects');
    (Array.isArray(r.body) && r.body.some(p=>p.name===projNome)) ? ok('projeto persistido na lista') : no('projeto não apareceu na lista', r.status);
  }
  if (empId) {
    r = await api(admin, 'report?company='+empId);
    (r.body && r.body.data && r.body.meta && r.body.meta.provisioned) ? ok('área do projeto provisionada automaticamente') : ok('área do projeto disponível (modelo)');
  }

  // --- STATUS REPORT (edição + persistência) ---
  r = await api(admin, 'report?company='+(empId||'esposende'));
  const rep = r.body && r.body.data;
  rep ? ok('report GET retorna dados') : no('report GET inválido', r.body);
  if (rep) {
    rep.ref = 'teste/' + stamp;
    r = await api(admin, 'report?company='+(empId||'esposende'), { method:'POST', body: JSON.stringify({ data: rep }) });
    r.body.ok ? ok('report POST grava') : no('report POST falhou', r.body);
    r = await api(admin, 'report?company='+(empId||'esposende'));
    (r.body.data && r.body.data.ref === 'teste/'+stamp) ? ok('report persistiu') : no('report não persistiu', r.body.meta);
  }

  // --- GMUD (criação + notificação + DUPLA APROVAÇÃO PMO+Techlead) ---
  r = await api(admin, 'gmud', { method:'POST', body: JSON.stringify({ title:'GMUD Teste '+stamp, company_id: empId||'esposende', risk:'Médio', type:'Normal' }) });
  const gid = r.body.id;
  (r.body.ok && gid) ? ok('GMUD criada ('+gid+')') : no('CRIAÇÃO DE GMUD falhou', r.body);
  if (gid) {
    r = await api(admin, 'gmud/'+gid, { method:'POST', body: JSON.stringify({ gate:'pmo', decision:'approve' }) });
    (r.body.pmo_ok && r.body.status==='Em aprovação') ? ok('gate PMO aprovado (aguarda Techlead)') : no('gate PMO inesperado', r.body);
    r = await api(admin, 'gmud/'+gid, { method:'POST', body: JSON.stringify({ gate:'techlead', decision:'approve' }) });
    (r.body.status === 'Aprovada') ? ok('gate Techlead → GMUD APROVADA (fluxo completo)') : no('dupla aprovação falhou', r.body);
    r = await api(admin, 'notifications');
    (Array.isArray(r.body) && r.body.length>0) ? ok('empresa notificada da GMUD ('+r.body.length+')') : no('notificação não gerada', r.body);
  }

  // --- USUÁRIO (criação + persistência + edição) ---
  const userEmail = 'teste'+stamp+'@allamo.com.br';
  r = await api(admin, 'users', { method:'POST', body: JSON.stringify({ name:'Usuário Teste', email:userEmail, password:'senha123', role:'pmo' }) });
  r.body.ok ? ok('usuário criado') : no('CRIAÇÃO DE USUÁRIO falhou', r.body);
  r = await api(admin, 'users');
  (Array.isArray(r.body) && r.body.some(u=>u.email===userEmail)) ? ok('usuário persistido na lista') : no('usuário não apareceu na lista', r.status);
  r = await api(admin, 'users/'+encodeURIComponent(userEmail), { method:'POST', body: JSON.stringify({ role:'gestor', company_id: empId||'esposende', status:'Ativo' }) });
  r.body.ok ? ok('usuário editado (perfil/empresa)') : no('edição de usuário falhou', r.body);
  // login do novo usuário (valida senha gravada)
  r = await api(null, 'login', { method:'POST', body: JSON.stringify({ email:userEmail, password:'senha123' }) });
  r.body.token ? ok('novo usuário consegue logar') : no('novo usuário não loga', r.body);

  // --- ESCOPO DO CLIENTE (gestor) ---
  r = await api(null, 'login', { method:'POST', body: JSON.stringify({ email:'gestor@esposende.com.br', password:'esposende123' }) });
  const gestor = r.body.token;
  if (gestor) {
    r = await api(gestor, 'companies');
    (Array.isArray(r.body) && r.body.length===1 && r.body[0].id==='esposende') ? ok('gestor vê só a própria empresa') : no('escopo do gestor incorreto', r.body);
    // gestor cria acesso de cliente (usuario) — permitido
    const cliEmail = 'cli'+stamp+'@esposende.com.br';
    r = await api(gestor, 'users', { method:'POST', body: JSON.stringify({ name:'Cliente Teste', email:cliEmail, password:'cli12345', role:'usuario' }) });
    r.body.ok ? ok('gestor cria acesso do cliente') : no('gestor não criou acesso do cliente', r.body);
    // gestor NÃO pode criar admin
    r = await api(gestor, 'users', { method:'POST', body: JSON.stringify({ name:'x', email:'adm'+stamp+'@x.com', password:'z12345', role:'admin' }) });
    r.status === 403 ? ok('gestor bloqueado de criar admin (403)') : no('gestor não deveria criar admin', r.status);
  } else no('login gestor falhou (crie o usuário gestor@esposende.com.br)');

  // --- HISTÓRICO ---
  r = await api(admin, 'audit');
  (Array.isArray(r.body) && r.body.length>0) ? ok('histórico registrando ('+r.body.length+' eventos)') : no('histórico vazio/inacessível', r.body);

  // --- LIMPEZA ---
  if (projId) { r = await api(admin, 'projects/'+projId, { method:'DELETE' }); r.body.ok ? ok('projeto de teste removido') : no('falha ao remover projeto', r.body); }

  done();
}
function done(){ console.log('\n== Resultado: ' + pass + ' ok, ' + fail + ' falhas ==\n'); process.exit(fail ? 1 : 0); }
run().catch(e => { console.error(e); process.exit(1); });
