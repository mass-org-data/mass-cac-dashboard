import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const contexts=[{kind:'all',centres:data.centres.map(c=>c.id)}];
for(const c of data.centres)contexts.push({kind:'centre',centres:[c.id],centre:c.id});
for(const donor of [...new Set(data.centres.map(c=>c.donor))].filter(Boolean))contexts.push({kind:'donor',donor,centres:data.centres.filter(c=>c.donor===donor).map(c=>c.id)});
for(const officer of [...new Set(data.centres.flatMap(c=>c.officers))])contexts.push({kind:'officer',officer,centres:data.centres.filter(c=>c.officers.includes(officer)).map(c=>c.id)});
const cases=[];
for(const context of contexts)for(const month of ['2026-04','2026-10'])for(const grade of ['', '1','5','6','10'])for(const shift of ['','Morning','Evening'])for(const gender of ['','Girl','Boy','Unknown'])for(const [earlier,later]of [[1,2],[2,1]])cases.push({context,month,grade,shift,gender,earlier,later});
fs.writeFileSync(process.argv[3],JSON.stringify(cases));
const lit=value=>value===''?'NULL':"'"+String(value).replaceAll("'","''")+"'";
let sql="SET ROLE authenticated;SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000004\"}',false);\n";
for(const [id,c]of cases.entries()){
 const end=new Date(Date.UTC(2026,Number(c.month.slice(5)),0)).toISOString().slice(0,10),until=new Date(Date.UTC(2026,Number(c.month.slice(5)),1)).toISOString().slice(0,10);
 sql+=`SELECT jsonb_build_object('case',${id},'result',mass_api.reviewed_chart_metrics(ARRAY[${c.context.centres.map(lit).join(',')}]::uuid[],${lit(end)},${lit(c.month+'-01')},${lit(until)},'20000000-0000-4000-8000-000000000001',${lit(c.grade)},${lit(c.shift)},${lit(c.gender)},${c.earlier},${c.later}));\n`;
}
fs.writeFileSync(process.argv[4],sql);
console.log('Prepared '+cases.length+' independent SQL/frontend scope/filter/pair cases.');
