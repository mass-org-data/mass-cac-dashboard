import {BackendError} from './api.js';
const uuid=value=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||''))throw new Error('Choose a verified directory identifier.');return value;};
export function createDirectoryApi(client) {
  const api=client.schema('mass_api');
  async function pages(name,args,signal) {
    const rows=[];
    for(let page=0;page<100;page++) {
      let result;
      try {const q=api.rpc(name,{...args,p_limit:100,p_offset:page*100});result=await(signal?q.abortSignal(signal):q);}
      catch {throw new BackendError({message:'network'},0,false);}
      if(result.error)throw new BackendError(result.error,result.status,false);
      if(!Array.isArray(result.data))throw new Error('Unexpected directory response.');
      rows.push(...result.data);
      if(result.data.length<100)return rows;
    }
    throw new Error('Directory selection exceeds the approved request limit.');
  }
  return {
    centres:({centre=null,donor=null,signal}={})=>pages('get_centre_directory',{p_centre:centre===null?null:uuid(centre),p_donor:donor===null?null:uuid(donor)},signal),
    staff:({centre,shift=null,signal})=>{
      if(shift!==null&&!['Morning','Evening'].includes(shift))throw new Error('Choose Morning, Evening or all assignments.');
      return pages('get_centre_staff',{p_centre:uuid(centre),p_shift:shift},signal);
    },
  };
}
export function directoryCentres(context,directory,donor='') {
  const allowed=new Set(context.map(c=>c.id));
  return directory.filter(c=>allowed.has(c.centre_id)&&(!donor||c.donor_id===donor));
}
