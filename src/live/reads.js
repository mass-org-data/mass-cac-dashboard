import {BackendError} from './api.js';

export function createReadApi(client) {
  const api = client.schema('mass_api');
  async function call(name, args = {}, signal) {
    let result;
    try { const query=api.rpc(name,args); result=await (signal?query.abortSignal(signal):query); }
    catch { throw new BackendError({message:'network'},0,false,name); }
    if(result.error) throw new BackendError(result.error,result.status,false,name);
    return result.data;
  }
  async function rows(name,args,signal) {
    const all=[];
    for(let page=0;page<100;page++) {
      const batch=await call(name,{...args,p_limit:100,p_offset:page*100},signal);
      if(!Array.isArray(batch)) throw new Error('Unexpected programme response.');
      all.push(...batch);
      if(batch.length<100) return all;
    }
    throw new Error('This selection contains too many records. Request a narrower approved read workflow.');
  }
  return {
    rows,
    context: signal=>call('get_context',{},signal),
    references: signal=>call('get_references',{},signal),
    async centre({centre,from,until,yearFrom=from,yearUntil=until,includeAssessments=true,signal}) {
      const window={p_centre:centre,p_from:from,p_until:until};
      const [students,attendance,calendar,assessments,activities,participation,morarji]=await Promise.all([
        rows('read_students',{p_centre:centre,p_on:null},signal),
        rows('read_attendance',{...window,p_child:null},signal),
        rows('read_calendar',window,signal),
        includeAssessments?rows('read_assessments',{p_centre:centre,p_from:yearFrom,p_until:yearUntil,p_child:null},signal):Promise.resolve([]),
        rows('read_activities',window,signal),
        rows('read_participation',{...window,p_event:null,p_child:null},signal),
        rows('read_morarji',{p_centre:centre,p_cohort:null},signal),
      ]);
      return {centre,students,attendance,calendar,assessments,activities,participation,morarji};
    },
  };
}
