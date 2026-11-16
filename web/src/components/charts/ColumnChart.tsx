export interface ColumnItem {label: string; value: number | null; tone?: 'brand' | 'accent'}

// Nice axis maximum: 1, 2, 5 times a power of ten, with four ticks.
export function niceTicks(max: number, count = 4): {top: number; ticks: number[]} {
  const safe = Math.max(1, Math.ceil(max));
  const magnitude = 10 ** Math.floor(Math.log10(safe));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s * count >= safe) ?? magnitude * 10;
  const top = Math.ceil(safe / step) * step;
  return {top, ticks: Array.from({length: Math.round(top / step) + 1}, (_, i) => i * step)};
}

const fill = {brand: 'var(--color-brand-dark)', accent: 'var(--color-warn)'} as const;

/** Accessible SVG column chart. Unknown values draw no bar and read "not recorded". */
export function ColumnChart({items, axis = 'Students', description}: {items: ColumnItem[]; axis?: string; description: string}) {
  const {top, ticks} = niceTicks(Math.max(0, ...items.map(item => item.value ?? 0)));
  const width = 380, height = 278, left = 44, right = 12, baseline = 202, plot = 168;
  const step = (width - left - right) / Math.max(1, items.length);
  const barWidth = Math.min(34, step * 0.62);
  const summary = items.map(item => `${item.label} ${item.value ?? 'not recorded'}`).join(', ');
  return (
    <figure className="m-0">
      <figcaption aria-hidden="true" className="mb-1 text-xs font-semibold text-muted">{axis}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${description}. ${axis}: ${summary}`} className="h-auto w-full max-w-md">
        {ticks.map(tick => {
          const y = baseline - (tick / top) * plot;
          return <g key={tick}><line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--color-line)" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="13" fill="var(--color-muted)">{tick}</text></g>;
        })}
        {items.map((item, index) => {
          const x = left + step * (index + 0.5);
          const barHeight = item.value === null ? 0 : (item.value / top) * plot;
          return (
            <g key={item.label}>
              <title>{`${item.label}: ${item.value ?? 'Not recorded'}`}</title>
              {item.value === null ? null : <rect x={x - barWidth / 2} y={baseline - barHeight} width={barWidth} height={barHeight} rx={4} fill={fill[item.tone ?? 'brand']} />}
              <text x={x} y={baseline - barHeight - 8} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--color-ink)">{item.value ?? '—'}</text>
              <text x={x} y={baseline + 22} textAnchor="middle" fontSize="13" fill="var(--color-muted)">{item.label}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
