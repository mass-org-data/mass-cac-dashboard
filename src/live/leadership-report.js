const SORTS = new Set(['name','students','girls','boys','donor','attendance','activity','assessment']);

export function sortCentreRows(rows, key = 'name') {
  const selected = SORTS.has(key) ? key : 'name';
  return [...rows].sort((a,b) => {
    const av = a[selected], bv = b[selected];
    if (typeof av === 'number' || typeof bv === 'number') {
      const left = Number.isFinite(Number(av)) ? Number(av) : -Infinity;
      const right = Number.isFinite(Number(bv)) ? Number(bv) : -Infinity;
      if (left !== right) return right - left;
    } else {
      const compared = String(av ?? '').localeCompare(String(bv ?? ''), undefined, {numeric:true,sensitivity:'base'});
      if (compared) return compared;
    }
    return String(a.name).localeCompare(String(b.name), undefined, {numeric:true,sensitivity:'base'});
  });
}

export function combineMonthlyAttendance(values) {
  const totals = values.reduce((out,value) => {
    if (!value || value.pending || value.unavailable) return out;
    out.p += Number(value.attendance?.p) || 0;
    out.a += Number(value.attendance?.a) || 0;
    out.l += Number(value.attendance?.l) || 0;
    out.loaded += 1;
    return out;
  }, {p:0,a:0,l:0,loaded:0});
  const denominator = totals.p + totals.a + totals.l;
  return Object.freeze({...totals, percentage:denominator ? 100 * totals.p / denominator : null});
}

export function attendanceLineChart(points, escapeHtml = String) {
  const width=680,height=260,left=48,right=18,top=20,bottom=54,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const x=index=>left+(points.length<2?plotWidth/2:index*plotWidth/(points.length-1));
  const y=value=>top+(100-value)*plotHeight/100;
  const segments=[];let current=[];
  for(let index=0;index<points.length;index++){
    const value=points[index].value;
    if(value===null||value===undefined||!Number.isFinite(Number(value))){if(current.length)segments.push(current);current=[];continue;}
    current.push(`${x(index)},${y(Number(value))}`);
  }
  if(current.length)segments.push(current);
  const grid=[0,25,50,75,100].map(value=>`<line x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}" stroke="#e2e7e1"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end" font-size="12" fill="#647775">${value}%</text>`).join('');
  const labels=points.map((point,index)=>`<text x="${x(index)}" y="${height-24}" text-anchor="middle" font-size="12" fill="#536864">${escapeHtml(point.label)}</text>`).join('');
  const lines=segments.map(segment=>`<polyline points="${segment.join(' ')}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const dots=points.map((point,index)=>point.value===null||point.value===undefined?'':`<g><title>${escapeHtml(point.label)}: ${Number(point.value).toFixed(1)}%</title><circle cx="${x(index)}" cy="${y(Number(point.value))}" r="4" fill="var(--brand)"/><text x="${x(index)}" y="${y(Number(point.value))-10}" text-anchor="middle" font-size="12">${Number(point.value).toFixed(1)}%</text></g>`).join('');
  const description=points.map(point=>`${point.label}: ${point.value===null||point.value===undefined?'unknown':Number(point.value).toFixed(1)+'%'}`).join(', ');
  return `<div class="line-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Attendance by month: ${escapeHtml(description)}">${grid}${lines}${dots}${labels}</svg></div>`;
}
