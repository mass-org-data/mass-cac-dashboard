// A missing *optional exact RPC* can select the reviewed 001–019 read path.
// Schema errors, permission failures, auth failures and network errors cannot.
export async function discoverCapabilities(rpc) {
 let value;
 try { value=await rpc('get_original_capabilities'); }
 catch(error) {
  if(error.rpc!=='get_original_capabilities'||error.status!==404||error.code!=='PGRST202')throw error;
  return Object.freeze({originalWorkflows:false,periodAssessments:false,operationalDetails:false,aggregates:false,baseline:true});
 }
 if(value?.original_workflows!==20||value?.period_assessments!==true)throw Error('The backend capability response is not recognized. No programme data was accepted.');
 return Object.freeze({originalWorkflows:true,periodAssessments:true,operationalDetails:value.operational_details===22,aggregates:value.aggregate_api===23,baseline:false});
}

export const BASELINE_READ_NOTICE='The installed read APIs support scoped student and attendance data. Quarter-inclusive assessments, operational details, visits, audit-history reads and profile-safe demographic aggregates require backend activation. Their controls remain available but unsupported saves are blocked.';

export function safeDiagnosticText(error) {
 const d=error?.diagnostic;
 if(!d?.rpc)return '';
 return `API: mass_api.${d.rpc} · HTTP ${d.status||'unavailable'}${d.code?' · '+d.code:''}`;
}
