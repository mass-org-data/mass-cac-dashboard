export const TODAY='2026-10-20';
export const centres=[
{id:'C01',name:'Aralimatti',officer:'Meera',donor:'McCafe'},
{id:'C02',name:'Avaradi',officer:'Meera',donor:'McCafe'},
{id:'C03',name:'Badigawad',officer:'Meera',donor:'McCafe'},
{id:'C04',name:'Hallur',officer:'Meera',donor:'Community Fund'},
{id:'C05',name:'Rajapur',officer:'Kavya',donor:'Community Fund'},
{id:'C06',name:'Timmapur',officer:'Kavya',donor:'Learning Partners'}];
const first=['Asha','Ravi','Sneha','Kiran','Pooja','Manoj','Divya','Arun','Nisha','Vijay','Anita','Rohan','Deepa','Sagar','Kavita','Naveen','Geeta','Akash','Rekha','Prakash','Latha','Varun','Suma','Ajay'];
const last=['Patil','Naik','Gowda','Kulkarni','Joshi','Hegde'];
export function operatingDates(month,elapsed=true){let a=[];const [y,m]=month.split('-').map(Number);for(let d=1;d<=31;d++){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCMonth()!==m-1)break;const iso=dt.toISOString().slice(0,10);if(dt.getUTCDay()!==0&&(!elapsed||iso<=TODAY))a.push(iso);}return a.slice(0,24);}
export function seed(){const students=[],attendance={},participation={},scores={},events=[],visits=[],morarji={},guidance=[];
centres.forEach((c,ci)=>{for(let i=0;i<12;i++){const n=ci*12+i,id=`CAC-${String(n+1).padStart(3,'0')}`;students.push({id,name:first[n%24]+' '+last[(Math.floor(n/24)+ci)%last.length],centre:c.id,shift:i<6?'Morning':'Evening',grade:String([1,2,3,4,3,4,5,6,7,8,9,10][i]),gender:n%2===0?'Girl':'Boy',enrolled:'2026-04-01',active:true,note:''});scores[id]={F1:Math.max(2,7+(n*3)%16),F2:n%17===0?null:Math.min(25,8+(n*5)%18),F3:null,F4:null};
for(const month of ['2026-09','2026-10']){let days=operatingDates(month);const present=Math.max(0,[23,21,20,14,15,18,22,12,24,19,16,21][i]-(ci%3));for(let j=0;j<days.length;j++){if(month==='2026-10'&&days[j]===TODAY&&i%3===0)continue;if(ci===5&&i<3&&j===days.length-2)continue;attendance[`${id}|${days[j]}`]=j<present?'P':'A';}}
}
for(const [month,dates] of [['2026-09',['05','12','19','26']],['2026-10',['03','10','17','24']]])dates.forEach((d,j)=>{const id=`${c.id}-${month}-E${j+1}`,date=month+'-'+d;events.push({id,centre:c.id,date,category:j%2===0?'Cultural':'Sports',name:['Folk dance & song','Team games','Storytelling circle','Relay & kho-kho'][j],status:date>TODAY?'Planned':'Held'});students.filter(s=>s.centre===c.id).forEach((s,i)=>{if(date>TODAY)return;const attended=[4,3,2,1,0,3,4,1,4,2,3,3][i];participation[`${s.id}|${id}`]=i===5&&ci===5&&j===3?'Unknown':j<attended?'Attended':'Not attended';});});
const count=ci===2?2:ci===3?3:4;for(let j=0;j<count;j++)visits.push({id:`V-${ci}-${j}`,centre:c.id,officer:c.officer,shift:j%2===0?'Morning':'Evening',date:`2026-09-${['04','11','18','25'][j]}`,status:'Completed',feedback:ci===2?'Review the remaining evening-shift visit.':'Attendance records reviewed with the teacher.',action:ci===2?'Confirm a follow-up visit.':'Continue monthly review.'});
const child=students.find(s=>s.centre===c.id&&s.grade==='6');morarji[child.id]={cohort:'2025–26',trainingDays:ci%2?19:23,applied:ci!==5,took:ci!==5,result:ci===4?'Pending':ci===5?'Not applied':ci===2?'Not passed':'Passed',selected:ci===0||ci===1,admitted:ci===0||ci===1,scholarship:ci===0?'Received':ci===1?'Pending':'Not recorded'};
});
for(let i=0;i<12;i++)guidance.push({id:`G-${i+1}`,name:first[(i+9)%24]+' '+last[i%6],centre:centres[i%6].id,grade:String(10+i%3),gender:i%2?'Boy':'Girl',session:'2026-01-16',followup:'2026-09-30',contact:i%5===0?'Not contacted':'Contacted',destination:i%5===0?'Unknown':['Class 11 — Arts','Class 11 — Science','ITI — Electrical','Diploma course','Class 12'][i%5],verification:i%3===0?'Verified admission':'Self-reported'});
const sessions=[];for(const c of centres)for(const month of ['2026-09','2026-10'])for(const date of operatingDates(month,false))for(const shift of ['Morning','Evening'])sessions.push({centre:c.id,date,shift,status:date>=TODAY?'Planned':c.id==='C03'&&date.endsWith('04')?'Cancelled':'Held'});
return {version:1,morarjiHistory:seedMorarjiHistory(),sessions,students,attendance,participation,scores,events,visits,morarji,guidance,followups:{},lastSaved:null};}
export function attendanceBand(n){return n<15?{label:'Below 15 · low',tone:'red'}:n===15?{label:'15 · average',tone:'amber'}:n<=20?{label:'16–20 · good',tone:'blue'}:n<=25?{label:'21–25 · very good',tone:'green'}:{label:'Check count',tone:'amber'};}
export function activityBand(n,unknown=0){return unknown?{label:'Incomplete',tone:'muted'}:n<2?{label:'Below 2 · low',tone:'red'}:{label:'2+ activities',tone:'green'};}
export function examBand(n){if(n===null||n===undefined||n==='')return {label:'Not recorded',tone:'muted'};if(n<=8)return {label:'0–8 · label to confirm',tone:'red'};if(n<=15)return {label:'9–15 · average',tone:'amber'};if(n<=20)return {label:'16–20 · good',tone:'blue'};if(n<=25)return {label:'21–25 · excellent',tone:'green'};return {label:'Check scale',tone:'amber'};}

// Independent fictional historical cohort; not repeated current students.
export function seedMorarjiHistory(){return centres.map((c,i)=>({s:{id:'M24-'+c.id,name:['Bhavana','Chetan','Ishita','Darshan','Shruti','Harish'][i]+' Naik',centre:c.id,gender:i%2?'Boy':'Girl'},cohort:'2024–25',trainingDays:18+i,applied:true,took:i!==5,result:i<2?'Passed':i===5?'Pending':'Not passed',selected:i===0,admitted:i===0,scholarship:i===0?'Received':'Not recorded'}));}
