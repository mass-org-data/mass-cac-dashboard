export function createAssessmentRegister({rpc,enabled,rerender}){
 let epoch=0;const cache=new Map();
 return {invalidate(){epoch++;cache.clear();},read(state,centres){
  if(!enabled)return null;
  const key=JSON.stringify([state.academicYear,state.shift,state.grade,state.gender,centres.map(c=>c.id).sort()]);
  if(!cache.has(key)){
   const current=epoch;cache.set(key,{pending:true});
   const request=centres.length?rpc('assessment_register_summary',{p_centres:centres.map(c=>c.id),p_year:state.academicYear,p_shift:state.shift||null,p_grade:state.grade||null,p_gender:state.gender||null}):Promise.resolve([]);
   void request.then(rows=>{if(current===epoch){cache.set(key,{rows});rerender();}}).catch(error=>{if(current===epoch){cache.set(key,{error:error.message});rerender();}});
  }return cache.get(key);
 }};
}
