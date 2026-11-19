// Read only rendered widget markup. Older deployed pages do not have audit attributes.
export async function locateSurface(page,ref) {
 const marked=page.locator(`[data-audit-ref="${ref}"]`);
 if(await marked.count())return marked;
 const exact=new RegExp('^'+ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
 return page.locator('main [role="group"], main [role="region"], main section')
  .filter({has:page.locator('h2 > span, p > span').filter({hasText:exact})});
}
export async function cardDisplay(root) {
 const marked=root.locator('[data-audit-display]');
 const value=await marked.count()?marked:root.locator('p.text-4xl');
 return await value.count()===1?value.innerText():null;
}
export async function tablePage(root) {
 // Exclude screen-reader sort announcements from the semantic column name.
 const heads=await root.locator('thead th').evaluateAll(nodes=>nodes.map(th=>{
  const copy=th.cloneNode(true);for(const e of copy.querySelectorAll('.sr-only,svg'))e.remove();
  return copy.textContent.trim().replace(/\s+/g,' ').toLowerCase();
 }));
 const rows=await root.locator('tbody tr').evaluateAll(nodes=>nodes.filter(tr=>!tr.querySelector('td[colspan]')).map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent?.trim()||'')));
 return rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]])));
}
export async function waitTableChange(root,before,timeout=30000) {
 const start=Date.now();
 while(Date.now()-start<timeout){if(await root.locator('tbody').innerText()!==before)return;await new Promise(r=>setTimeout(r,50));}
 throw Error('Table did not advance after Next page.');
}

export function canonicalDimension(d){return ({Girls:'Girl',Boys:'Boy',Sept:'Sep'})[d]||d;}
