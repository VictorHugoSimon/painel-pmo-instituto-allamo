// worker-cron.js — Cloudflare Worker AGENDADO (cron) do Portal PMO Allamo
// Deploy separado do site (Pages). Faz, todo dia 1 às 06:00 UTC:
//  - carimba o mês de referência (ref) de cada projeto
//  - salva um snapshot mensal do Status Report (histórico de cadência)
// wrangler.cron.toml acompanha este arquivo.

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function refAtual(d){ return MESES[d.getUTCMonth()] + '/' + String(d.getUTCFullYear()).slice(2); }

export default {
  async scheduled(event, env, ctx) {
    const ref = refAtual(new Date());
    // snapshot de tudo que existe
    const rows = (await env.DB.prepare('SELECT company_id, data_json FROM project_reports').all()).results || [];
    for (const r of rows) {
      await env.DB.prepare("INSERT INTO report_snapshots (company_id, ref, data_json, taken_at) VALUES (?,?,?,datetime('now'))")
        .bind(r.company_id, ref, r.data_json).run();
      await env.DB.prepare('UPDATE project_reports SET ref=? WHERE company_id=?').bind(ref, r.company_id).run();
    }
    await env.DB.prepare("INSERT INTO audit_log (ts,actor,role,action,target,detail) VALUES (datetime('now'),'cron','sistema','report:snapshot','todos','Snapshot mensal ("+ref+") de "+rows.length+" projetos')").run();
  }
};
