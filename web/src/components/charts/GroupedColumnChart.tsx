import {niceTicks} from './ColumnChart';

export interface GroupedItem {label: string; values: Array<number | null>}
const COLOURS = ['var(--color-muted)', 'var(--color-brand)', 'var(--color-accent)', 'var(--color-brand-dark)'];

/** Accessible grouped vertical bar chart: one group per label (x-axis), one bar per series in each group (y-axis counts).
 *  Unknown values draw no bar and read "not recorded". A legend names each series by colour. */
export function GroupedColumnChart({items, series, axis, description}: {items: GroupedItem[]; series: string[]; axis: string; description: string}) {
  const {top, ticks} = niceTicks(Math.max(0, ...items.flatMap(item => item.values.map(v => v ?? 0))));
  const groupWidth = 96, left = 44, right = 12, baseline = 214, plot = 170;
  const width = Math.max(380, left + right + groupWidth * Math.max(1, items.length)), height = 276;
  const barWidth = Math.min(18, (groupWidth - 16) / Math.max(1, series.length));
  const summary = items.map(item => `${item.label}: ${series.map((name, i) => `${name} ${item.values[i] ?? 'not recorded'}`).join(', ')}`).join('; ');
  return (
    <figure className="m-0">
      <figcaption aria-hidden="true" className="mb-1 text-xs font-semibold text-muted">{axis}</figcaption>
      <ul aria-hidden="true" className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((name, i) => <li key={name} className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm" style={{background: COLOURS[i % COLOURS.length]}} />{name}</li>)}
      </ul>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${description}. ${axis}. ${summary}`} style={{minWidth: Math.min(width, 380)}} className="h-auto w-full">
          {ticks.map(tick => {
            const y = baseline - (tick / top) * plot;
            return <g key={tick}><line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--color-line)" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="13" fill="var(--color-muted)">{tick}</text></g>;
          })}
          {items.map((item, index) => {
            const centre = left + groupWidth * (index + 0.5);
            const start = centre - (barWidth * series.length) / 2;
            return (
              <g key={item.label}>
                {series.map((name, i) => {
                  const value = item.values[i] ?? null;
                  const h = value === null ? 0 : (value / top) * plot;
                  const x = start + i * barWidth;
                  return (
                    <g key={name}>
                      <title>{`${item.label} · ${name}: ${value ?? 'Not recorded'}`}</title>
                      {value === null ? null : <rect x={x + 1} y={baseline - h} width={barWidth - 2} height={h} rx={3} fill={COLOURS[i % COLOURS.length]} />}
                      <text x={x + barWidth / 2} y={baseline - h - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink)">{value ?? '—'}</text>
                    </g>
                  );
                })}
                <text x={centre} y={baseline + 22} textAnchor="middle" fontSize="13" fill="var(--color-muted)">{item.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
