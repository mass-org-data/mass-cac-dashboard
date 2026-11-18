import {CATALOG,CUTOFF,STATUSES} from './catalog.mjs';
export {CATALOG,CUTOFF,STATUSES};
export function validateScenario(s) {
 if(!s||!/^\d{4}-\d{2}$/.test(s.month)||s.month>'2026-10'||s.month<'2026-04')throw Error('Reporting month must be April–October 2026.');
 if(!['Leadership','Cluster Officer','Teacher'].includes(s.role))throw Error('A verified dashboard role is required.');
 if(!['production','preview','synthetic'].includes(s.environment))throw Error('Explicit database environment required.');
 if(typeof s.project!=='string'||(s.environment!=='synthetic'&&!/^[a-z]{20}$/.test(s.project)))throw Error('A verified database project is required.');
 if(!Array.isArray(s.centres)||!s.centres.length||s.centres.length>100||s.centres.some(c=>!c||!c.id||!/^[0-9a-f-]{36}$/i.test(c.id)||typeof c.label!=='string'))throw Error('Explicit bounded centre IDs and labels required.');
 for(const [key,values] of [['shift',['Morning','Evening']],['gender',['Girl','Boy','Unknown']],['grade',Array.from({length:10},(_,i)=>String(i+1))]])if(s[key]!=null&&!values.includes(s[key]))throw Error('Invalid '+key);
 if(s.officer!=null&&!/^[0-9a-f-]{36}$/i.test(s.officer))throw Error('Invalid officer');
 if(s.donor!=null&&typeof s.donor!=='string')throw Error('Invalid donor');
 if(!Number.isInteger(s.round??2)||!Number.isInteger(s.earlier??1)||!Number.isInteger(s.later??2)||(s.earlier??1)===(s.later??2)||[s.round??2,s.earlier??1,s.later??2].some(n=>n<1||n>4))throw Error('Invalid assessment rounds');
 return {...s,cutoff:CUTOFF,round:s.round??2,earlier:s.earlier??1,later:s.later??2};
}
export const scenarioKey=s=>JSON.stringify([s.environment,s.project,s.role,s.month,s.centres.map(c=>c.id).sort(),s.shift??null,s.grade??null,s.gender??null,s.donor??null,s.round??2,s.earlier??1,s.later??2,s.officer??null,CUTOFF]);
export function parseDisplay(text,unit='count') {
 if(typeof text==='number')return Number.isFinite(text)?text:null;
 if(typeof text!=='string'||/not available|unavailable|unknown|not recorded|loading|^\s*[—–-]\s*$/i.test(text))return null;
 const cleaned=text.replace(/,/g,'').replace(/\u2212/g,'-').trim();
 if(unit==='ratio'){const m=cleaned.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);return m?`${Number(m[1])}/${Number(m[2])}`:null;}
 const pattern=unit==='percent'?/([-+]?\d+(?:\.\d+)?)\s*%/:/^\s*([-+]?\d+(?:\.\d+)?)(?:\s|$)/;
 const m=cleaned.match(pattern);return m?Number(m[1]):null;
}
export function compare(expected,capture,metric,scenario) {
 if(!metric.roles.includes(scenario.role))return {status:'Not applicable',note:'This role has no applicable dashboard surface.'};
 if(metric.cutoffBlocked)return {status:'Cutoff unverifiable',note:'No verified observation date; current value cannot prove the October cutoff.'};
 if(scenario.role==='Cluster Officer'&&metric.id==='OV01')return {status:'Calculation unavailable',note:'Assigned-centre total must be verified independently of the selected-centre filter.'};
 if(scenario.role==='Cluster Officer'&&metric.page==='Visits'&&!scenario.officer)return {status:'Calculation unavailable',note:'Supply the verified officer identity for this role before comparing own-visit counts.'};
 if(metric.definitionReview)return {status:'Calculation unavailable',note:'Programme definition review required: relative percentage improvement versus change in marks.'};
 if(metric.blocked)return {status:'Calculation unavailable',note:metric.blocked};
 if(expected===null||expected===undefined)return {status:'Data unavailable',note:'No eligible numeric source observation; zero is not inferred.'};
 if(!capture)return {status:'Not tested',note:'No actual dashboard capture. Reference value alone is not a pass.'};
 if(capture.state==='cutoff')return {status:'Cutoff unverifiable',note:capture.note||'The page cannot apply the requested historical cutoff.'};
 if(capture.state!=='ready')return {status:'Dashboard unavailable',note:capture.note||'The dashboard did not return a comparable displayed value.'};
 const actual=parseDisplay(capture.display,metric.unit);
 if(actual===null)return {status:'Dashboard unavailable',note:'Displayed value is missing or not in the documented unit.'};
 const rounded=metric.unit==='ratio'?String(expected):Number(Number(expected).toFixed(metric.precision));
 return {status:actual===rounded?'Match':'Mismatch',actual,difference:typeof actual==='number'?actual-rounded:null,note:metric.definitionReview?'Calculation definition review required; display equality alone does not approve the formula.':''};
}
export function makeRun(reference,captures=null) {
 if(reference.schemaVersion!==1||!Array.isArray(reference.facts)||!reference.extractedAt||!reference.project)throw Error('Invalid reference snapshot.');
 const scenario=validateScenario(reference.scenario);
 if(scenario.project!==reference.project)throw Error('Reference project differs from scenario.');
 if(captures&&(captures.schemaVersion!==1||captures.project!==reference.project||scenarioKey(captures.scenario)!==scenarioKey(scenario)||captures.cutoff!==CUTOFF||!/^[a-f0-9]{40}$/.test(captures.dashboardCommit||'')||!captures.capturedAt||!Array.isArray(captures.cells)))throw Error('Capture environment, scope, cutoff or version does not match the reference.');
 const captureMap=new Map();
 for(const c of captures?.cells||[]){const k=c.metric+'|'+c.dimension;if(captureMap.has(k))throw Error('Duplicate dashboard capture: '+k);captureMap.set(k,c);}
 const factKeys=new Set();for(const f of reference.facts){const key=f.key+'|'+(f.dimension??'All');if(factKeys.has(key))throw Error('Duplicate reference dimension: '+key);factKeys.add(key);}
 const rows=[];
 for(const metric of CATALOG){
  let facts=reference.facts.filter(f=>f.key===metric.source);
  if(!metric.dimension)facts=facts.filter(f=>(f.dimension??'All')==='All');
  if(!facts.length)facts=[{dimension:'All',value:null}];
  for(const f of facts){if(f.value!=null&&typeof f.value!=='string'&&(typeof f.value!=='number'||!Number.isFinite(f.value)))throw Error('Reference values must be finite scalars.');const dimension=f.dimension??'All',capture=captureMap.get(metric.id+'|'+dimension);rows.push({month:scenario.month,role:scenario.role,shift:scenario.shift??null,grade:scenario.grade??null,gender:scenario.gender??null,centre:scenario.centres.map(c=>c.label).join(' / '),sqlQueryId:typeof reference.sql==='string'?'reference':null,caseId:metric.id+'|'+dimension,metricId:metric.id,page:metric.page,label:metric.label,dimension,formula:metric.formula,tables:metric.tables||'',unit:metric.unit,precision:metric.precision,expected:f.value??null,display:capture?.display??null,evidence:capture?.evidence??null,sourceNote:f.note||'',captured:Boolean(capture),captureState:capture?.state??null,captureNote:capture?.note??'',...compare(f.value??null,capture,metric,scenario)});}
 }
 const freshness=captures?Boolean(captures.referenceFingerprint&&captures.referenceFingerprint===reference.fingerprint&&captures.referenceAfterFingerprint===reference.fingerprint):false;
 if(captures&&!freshness)for(const row of rows)if(['Match','Mismatch'].includes(row.status)){row.status='Not tested';row.note='Reference must be re-extracted after browser capture with an identical fingerprint before certifying this comparison.';}
 return {sqlQueries:typeof reference.sql==='string'?{reference:{sql:reference.sql,extractedAt:reference.extractedAt}}:{},freshnessVerified:freshness,schemaVersion:1,title:'MASS Indicator Verification Ledger',cutoff:CUTOFF,referenceAt:reference.extractedAt,capturedAt:captures?.capturedAt??null,project:reference.project,scenario,referenceFingerprint:reference.fingerprint??null,dashboardCommit:captures?.dashboardCommit??null,dashboardUrl:captures?.dashboardUrl??null,rows};
}
export function summarize(rows) {
 const counts=Object.fromEntries(STATUSES.map(s=>[s,rows.filter(r=>r.status===s).length]));
 const comparable=counts.Match+counts.Mismatch,applicable=rows.length-counts['Not applicable'];
 return {indicators:new Set(rows.map(r=>r.metricId)).size,cases:rows.length,counts,comparable,matchRate:comparable?100*counts.Match/comparable:null,coverage:applicable?100*comparable/applicable:null};
}
export function csv(rows) {
 const fields=['month','role','centre','shift','grade','gender','sqlQueryId','sql','caseId','metricId','page','label','dimension','expected','display','difference','unit','status','formula','tables','sourceNote','note','evidence'];
 const cell=x=>{let s=x==null?'':String(x);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return [fields.map(cell).join(','),...rows.map(r=>fields.map(f=>cell(r[f])).join(','))].join('\r\n');
}
export function validateRun(run) {
 if(!run||run.schemaVersion!==1||run.cutoff!==CUTOFF||!Array.isArray(run.rows)||run.rows.length>100000)throw Error('Not a supported October audit run.');
 validateScenario(run.scenario);
 const allowed=new Set(CATALOG.map(m=>m.id)),ids=new Set();
 for(const r of run.rows){if(!r||!allowed.has(r.metricId)||typeof r.caseId!=='string'||ids.has(r.caseId)||!STATUSES.includes(r.status))throw Error('Invalid or duplicate audit row.');ids.add(r.caseId);for(const key of ['label','page','dimension','formula','tables'])if(typeof r[key]!=='string')throw Error('Invalid row text.');if(r.expected!==null&&typeof r.expected!=='number'&&typeof r.expected!=='string')throw Error('Invalid source value.');}
 for(const q of Object.values(run.sqlQueries||{}))if(!q||typeof q.sql!=='string'||q.sql.length>200000)throw Error('Invalid SQL query log.');
 const metrics=new Map(CATALOG.map(m=>[m.id,m]));
 return {...run,rows:run.rows.map(r=>{const metric=metrics.get(r.metricId),result=compare(r.expected,r.captured?{state:r.captureState|| (r.display===null?'unavailable':'ready'),display:r.display,note:r.captureNote}:null,metric,run.scenario);if(!run.freshnessVerified&&['Match','Mismatch'].includes(result.status))return {...r,status:'Not tested',note:'Data stability was not verified with a second reference extraction.'};return {...r,...result};})};
}

export function rowsForExport(run){return run.rows.map(r=>({...r,month:r.month||run.scenario.month,role:r.role||run.scenario.role,shift:r.shift??run.scenario.shift??null,grade:r.grade??run.scenario.grade??null,gender:r.gender??run.scenario.gender??null,centre:r.centre||run.scenario.centres.map(c=>c.label).join(' / '),sql:r.sql||run.sqlQueries?.[r.sqlQueryId]?.sql||''}));}
