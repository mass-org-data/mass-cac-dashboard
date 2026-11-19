// Owner-selected centres. Month and centre are separate scenarios, never one pooled total.
export const AUDIT_CENTRES=[
 {id:'ccbf0e1a-41db-53d4-b715-3833fb85d69a',label:'Aralimatti'},
 {id:'80e1cf2d-6468-53ff-8711-374eac2b2e4a',label:'Avaradi'},
];
export const AUDIT_MONTHS=Array.from({length:7},(_,i)=>`2026-${String(i+4).padStart(2,'0')}`);
// Reproducible pseudo-random draw; record the seed, not a hand-picked favourable result.
export const SAMPLE_SEED=20261118;
export function auditPlan({environment='production',project='pbkwpfdpdtelmvbkzgvx'}={}){
 const base={environment,project,shift:null,grade:null,gender:null,donor:null,round:2,earlier:1,later:2};
 const leadership=AUDIT_MONTHS.flatMap(month=>AUDIT_CENTRES.map(centre=>({...base,role:'Leadership',month,centres:[centre],sample:'Complete Leadership centre/month coverage'})));
 let seed=SAMPLE_SEED;const draw=n=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed%n;};
 const samples=['Cluster Officer','Teacher'].map(role=>({...base,role,month:AUDIT_MONTHS[draw(7)],centres:[AUDIT_CENTRES[draw(2)]],shift:['Morning','Evening'][draw(2)],sample:`Seeded role spot check (${SAMPLE_SEED})`}));
 return [...leadership,...samples];
}
