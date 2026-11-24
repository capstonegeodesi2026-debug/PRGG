const fs=require('fs'), path=require('path'), B=path.resolve(process.argv[2]||'.');
const CONFIG=require(path.join(B,'js/config.js')), S=require(path.join(B,'js/scoring.js'));
const grid=JSON.parse(fs.readFileSync(path.join(B,'data/grid.geojson')));
const ids=grid.features.map(f=>f.properties.grid_id), props=new Map(grid.features.map(f=>[f.properties.grid_id,f.properties]));
const issues=[], tables={};
for(const c of CONFIG.criteria) if(c.csv) tables[c.key]=S.buildTable(S.parseCSV(fs.readFileSync(path.join(B,c.csv),'utf8')),CONFIG.csv,c.key,issues);
const ref=S.parseCSV(fs.readFileSync(process.argv[3],'utf8')).rows, refBy=new Map(ref.map(r=>[r.id_grid.toUpperCase?r.id_grid:r.id_grid,r]));
const w=Object.fromEntries(CONFIG.criteria.map(c=>[c.key,c.weight]));
let worst=0, clsMis=0, tot=0;
for(let i=1;i<=20;i++){const t='TP'+String(i).padStart(3,'0'), fid='TP-'+t.slice(2);
  const res=S.compute(ids,tables,CONFIG.criteria,fid,w,props);
  for(const r of res){const rr=refBy.get(r.grid_id); const d=Math.abs(r.score-(+rr['skor_'+t.toLowerCase()])); worst=Math.max(worst,d); tot++; if(r.kelas!==+rr['kelas_'+t.toLowerCase()]) clsMis++;}
  if(i===1){const g=res.find(r=>r.grid_id==='G0001'); console.log('G0001 TP001',g.score.toFixed(2),'kelas',g.kelas,'range',res.range);}
}
console.log('issues',issues); console.log('max |diff skor|',worst.toFixed(4),'kelas berbeda',clsMis,'dari',tot);
