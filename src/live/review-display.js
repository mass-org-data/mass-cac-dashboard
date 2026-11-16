export function chartTicks(maximum, count=4) {
 const max=Math.max(1,Number(maximum)||0),raw=max/count,power=10**Math.floor(Math.log10(raw));
 const step=Math.max(1,[1,2,5,10].find(n=>n*power>=raw)*power),top=Math.ceil(max/step)*step;
 return {top,ticks:Array.from({length:Math.round(top/step)+1},(_,i)=>i*step)};
}

export function profileSortChoice(current,column) {
 return current===column?'-'+column:column;
}

export function preserveSearchFocus(root,render) {
 const active=document.activeElement,remember=active?.id==='student-search'&&root?.contains(active)?{start:active.selectionStart,end:active.selectionEnd}:null;
 render();
 if(remember){const input=root.querySelector('#student-search');input?.focus({preventScroll:true});input?.setSelectionRange(remember.start,remember.end);}
}
