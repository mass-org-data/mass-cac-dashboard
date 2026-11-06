import {monthWindow} from './model.js';

// Existing scoped summary RPC only. No raw feedback/history or anonymous API.
export async function loadVisitTrends({months, centres, officer=null, readSummary, concurrency=6}) {
 const tasks=months.flatMap(month=>centres.map(centre=>({month,centre}))), output=new Map(months.map(month=>[month,[]]));
 let index=0;
 async function worker(){while(index<tasks.length){const {month,centre}=tasks[index++],{from,until}=monthWindow(month);const rows=await readSummary({p_centre:centre,p_from:from,p_until:until,p_officer:officer});output.get(month).push(...rows);}}
 await Promise.all(Array.from({length:Math.min(concurrency,tasks.length)},worker));
 return Object.fromEntries(output);
}

export function summarizeVisitMonth(rows, centreIds, shift='') {
 const selected=rows.filter(r=>centreIds.includes(r.centre_id));
 const morning=selected.reduce((n,r)=>n+Number(r.morning),0),evening=selected.reduce((n,r)=>n+Number(r.evening),0);
 const observed=selected.some(r=>Number(r.recorded_count)>0),target=selected.length*(shift?2:4);
 const actual=observed?(shift==='Morning'?morning:shift==='Evening'?evening:morning+evening):null;
 return {morning:observed?morning:null,evening:observed?evening:null,actual,target,achievement:actual===null||!target?null:100*actual/target,
  centresMeetingBothShifts:observed?selected.filter(r=>Number(r.morning)>=2&&Number(r.evening)>=2).length:null};
}
