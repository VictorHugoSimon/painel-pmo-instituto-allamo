import { spawnSync } from 'node:child_process';
const db=process.argv[2];
if(!db){console.error('Uso: node scripts/migrate-work-management.mjs <database-name>');process.exit(2)}
const cols=[
  ['item_type',"TEXT DEFAULT 'TASK'"],['description','TEXT'],['acceptance_criteria','TEXT'],['parent_id','TEXT'],['project_id','INTEGER'],['sprint_id','TEXT'],['release_id','INTEGER'],['start_date','TEXT'],['story_points','REAL'],['estimate_hours','REAL'],['rank','REAL DEFAULT 0'],['reporter','TEXT'],['blocked','INTEGER DEFAULT 0'],['blocked_reason','TEXT'],['source',"TEXT DEFAULT 'allamo'"],['created_by','TEXT'],['updated_by','TEXT'],['created_at','TEXT'],['archived_at','TEXT']
];
const run=(args,{allowDuplicate=false}={})=>{const r=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['wrangler',...args],{encoding:'utf8',stdio:'pipe'});if(r.stdout)process.stdout.write(r.stdout);if(r.status!==0){const msg=(r.stderr||'')+(r.stdout||'');if(allowDuplicate&&/duplicate column name/i.test(msg)){console.log('SKIP coluna já existente');return}process.stderr.write(r.stderr||msg);process.exit(r.status||1)}};
console.log('== Államo Work Management migration ==');
for(const [name,type] of cols){console.log('Coluna:',name);run(['d1','execute',db,'--remote','--command',`ALTER TABLE issues ADD COLUMN ${name} ${type}`],{allowDuplicate:true})}
console.log('Criando tabelas, índices e normalizando dados...');
run(['d1','execute',db,'--remote','--file=./migration-work-management-finalize.sql']);
console.log('OK: migration concluída em',db);
