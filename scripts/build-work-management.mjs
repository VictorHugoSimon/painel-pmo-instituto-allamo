import fs from 'node:fs';
const worker='public/_worker.js', index='public/index.html';
const api=fs.readFileSync('src/work-management-api.js','utf8');
const ui=fs.readFileSync('src/work-management-ui.js','utf8');
const apiBlock=`    // BEGIN ALLAMO WORK MANAGEMENT\n${api.split('\n').map(x=>'    '+x).join('\n')}\n    // END ALLAMO WORK MANAGEMENT`;
let w=fs.readFileSync(worker,'utf8');
if(w.includes('// BEGIN ALLAMO WORK MANAGEMENT')){
  w=w.replace(/    \/\/ BEGIN ALLAMO WORK MANAGEMENT[\s\S]*?    \/\/ END ALLAMO WORK MANAGEMENT/,apiBlock);
}else{
  const needle="    // EMPRESAS: criar (rota dedicada)";
  if(!w.includes(needle)) throw new Error('Ponto de injeção do Worker não encontrado; revise _worker.js.');
  w=w.replace(needle,apiBlock+'\n\n'+needle);
}
fs.writeFileSync(worker,w);
console.log('OK: Work Management sincronizado em '+worker);
const launcher=`\n<!-- BEGIN ALLAMO WORK MANAGEMENT UI -->\n<script>\n${ui}\n</script>\n<script>\n(()=>{const add=()=>{if(document.getElementById('aw-launcher'))return;const b=document.createElement('button');b.id='aw-launcher';b.textContent='Trabalho';b.title='Államo Work Management';b.style.cssText='position:fixed;right:20px;bottom:86px;z-index:99980;border:0;border-radius:999px;padding:11px 16px;background:#242321;color:white;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer';b.onclick=()=>window.AllamoWork.open();document.body.appendChild(b)};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add()})();\n</script>\n<!-- END ALLAMO WORK MANAGEMENT UI -->\n`;
let h=fs.readFileSync(index,'utf8');
if(h.includes('<!-- BEGIN ALLAMO WORK MANAGEMENT UI -->')){
  h=h.replace(/\n?<!-- BEGIN ALLAMO WORK MANAGEMENT UI -->[\s\S]*?<!-- END ALLAMO WORK MANAGEMENT UI -->\n?/m,'\n'+launcher+'\n');
}else{
  if(!h.includes('</body>')) throw new Error('</body> não encontrado em index.html');
  h=h.replace('</body>',launcher+'</body>');
}
fs.writeFileSync(index,h);
console.log('OK: Work Management UI sincronizada em '+index);
