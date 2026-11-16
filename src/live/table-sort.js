const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
const value=cell=>cell?.dataset.sortValue??cell?.querySelector('input,select')?.value??cell?.textContent.trim()??'';
export function compareTableValues(a,b){
 const missing=v=>!v||/^(—|unknown|not (recorded|entered|available)|source import)/i.test(v);
 if(missing(a)!==missing(b))return missing(a)?1:-1;
 const number=v=>/^[-+]?\d+(?:\.\d+)?(?:%|\s*\/.*)?$/.test(v)?parseFloat(v):null;
 const an=number(a),bn=number(b);return an!==null&&bn!==null?an-bn:collator.compare(a,b);
}
export function prepareTableSort(table,{key,states={}}={}){
 const rows=[...table.tBodies].flatMap(b=>[...b.rows]),headers=[...(table.tHead?.rows[0]?.cells||[])];
 if(table.dataset.sortable==='false'||!rows.length)return rows;
 const labels=headers.map(h=>h.textContent.trim());
 const date=labels.findIndex(t=>/^(date|assessment date|visit date|month|activity date)$/i.test(t));
 const name=labels.findIndex(t=>/^(student|name|centre|record|activity|officer)(\s|$)/i.test(t));
 const selection=states[key]??(date>=0?{column:date,direction:-1}:name>=0?{column:name,direction:1}:null);
 const sort=choice=>{
  for(const [i,h] of headers.entries())h.setAttribute('aria-sort',choice?.column===i?(choice.direction===1?'ascending':'descending'):'none');
  if(choice){rows.sort((a,b)=>{const av=value(a.cells[choice.column]),bv=value(b.cells[choice.column]);const absent=v=>!v||/^(—|unknown|not (recorded|entered|available))/i.test(v);if(absent(av)!==absent(bv))return absent(av)?1:-1;const primary=choice.column===date&&Number.isFinite(Date.parse(av))&&Number.isFinite(Date.parse(bv))?Date.parse(av)-Date.parse(bv):compareTableValues(av,bv);return primary*choice.direction||(name>=0?collator.compare(value(a.cells[name]),value(b.cells[name])):0);});for(const row of rows)table.tBodies[0].append(row);}
 };
 headers.forEach((h,column)=>{
  if(!labels[column]||/^(action|actions)$/i.test(labels[column]))return;
  const button=document.createElement('button');button.type='button';button.className='table-sort';button.textContent=labels[column]+' ↕';button.setAttribute('aria-label','Sort by '+labels[column]);
  button.addEventListener('click',()=>{const current=states[key]??selection;const choice={column,direction:current?.column===column?-current.direction:1};states[key]=choice;sort(choice);table.dispatchEvent(new Event('table-sorted'));});h.replaceChildren(button);
 });sort(selection);return rows;
}
