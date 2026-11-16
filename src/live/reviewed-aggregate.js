// Builds the programme aggregate shape (as the old per-centre programme_aggregate loop summed it)
// from one all-centre reviewed_chart_metrics result, so the Overview needs no per-centre calls.
export function aggregateFromReviewed(m,state){
  const quarters={};for(const q of m.quarters||[])quarters[q.quarter]={n:Number(q.n||0),total:Number(q.mean||0)*Number(q.n||0),low:Number(q.low||0),developing:Number(q.developing||0),good:Number(q.good||0),strong:Number(q.strong||0),above20:Number(q.above20||0),precision_review:Number(q.precision_review||0)};
  const changes={},c=m.changes;if(c&&Number(c.n)>0)changes[Number(state.fromExam.slice(1))+'|'+Number(state.toExam.slice(1))]={n:Number(c.n),earlier:Number(c.earlierMean||0)*Number(c.n),later:Number(c.laterMean||0)*Number(c.n),improved:Number(c.improved||0),unchanged:Number(c.unchanged||0),declined:Number(c.declined||0)};
  const a=m.attendance||{};
  return {students:Number(m.children||0),grades:{...m.grades},genders:{...m.genders},attendance:{p:Number(a.p||0),a:Number(a.a||0),l:Number(a.l||0),excluded:Number(a.excluded||0)},quarters,changes,centres:(m.centres||[]).map(r=>({centre_id:r.id,students:Number(r.children||0),attendance:{p:Number(r.attendance?.p||0),a:Number(r.attendance?.a||0),l:Number(r.attendance?.l||0),excluded:Number(r.attendance?.excluded||0)}}))};
}
