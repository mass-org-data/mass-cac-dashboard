export interface LinePoint {label: string; value: number | null}

/** Percentage line (0 to 100). Unknown months are gaps, never zero. */
export function LineChart({points, description}: {points: LinePoint[]; description: string}) {
  const width = 680, height = 260, left = 48, right = 18, top = 20, bottom = 54;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (index: number) => left + (points.length < 2 ? plotWidth / 2 : (index * plotWidth) / (points.length - 1));
  const y = (value: number) => top + ((100 - value) * plotHeight) / 100;
  const segments: string[][] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) { if (current.length) segments.push(current); current = []; return; }
    current.push(`${x(index)},${y(point.value)}`);
  });
  if (current.length) segments.push(current);
  const summary = points.map(point => `${point.label}: ${point.value === null ? 'unknown' : `${point.value.toFixed(1)}%`}`).join(', ');
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${description}. ${summary}`} className="h-auto max-h-80 w-full">
        {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1={left} y1={y(value)} x2={width - right} y2={y(value)} stroke="var(--color-line)" /><text x={left - 8} y={y(value) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">{value}%</text></g>)}
        {segments.map((segment, index) => segment.length > 1 ? <polyline key={index} points={segment.join(' ')} fill="none" stroke="var(--color-brand-dark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null)}
        {points.map((point, index) => point.value === null ? null : <g key={point.label}><title>{`${point.label}: ${point.value.toFixed(1)}%`}</title><circle cx={x(index)} cy={y(point.value)} r={4.5} fill="var(--color-brand-dark)" /></g>)}
        {points.map((point, index) => <text key={`l${point.label}`} x={x(index)} y={height - 24} textAnchor="middle" fontSize="12" fill="var(--color-muted)">{point.label}</text>)}
      </svg>
    </figure>
  );
}
