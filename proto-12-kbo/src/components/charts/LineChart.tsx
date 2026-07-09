import styles from './charts.module.css';

export interface Series {
  name: string;
  color: string;
  points: number[]; // x 는 인덱스
}

/**
 * 경량 SVG 라인 차트. 팀 순위/득점 추이 등에 사용.
 */
export function LineChart({
  series,
  xLabels,
  title,
  height = 220,
  yFormat = (v) => String(Math.round(v)),
  invertY = false,
}: {
  series: Series[];
  xLabels: string[];
  title: string;
  height?: number;
  yFormat?: (v: number) => string;
  invertY?: boolean;
}) {
  const width = 640;
  const pad = { top: 12, right: 14, bottom: 26, left: 34 };
  const all = series.flatMap((s) => s.points).filter((v) => Number.isFinite(v));
  if (!all.length) return null;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const n = Math.max(...series.map((s) => s.points.length), 2);
  const x = (i: number) => pad.left + (i / (n - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => {
    const t = (v - min) / (max - min);
    const tt = invertY ? t : 1 - t;
    return pad.top + tt * (height - pad.top - pad.bottom);
  };
  const ticks = [min, (min + max) / 2, max];

  return (
    <div className={styles.lineWrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.lineSvg}
        role="img"
        aria-label={title}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              className={styles.grid}
            />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" className={styles.tick}>
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xLabels.map((label, i) =>
          i % Math.ceil(xLabels.length / 6) === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className={styles.tick}>
              {label}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
      </svg>
      <div className={styles.legend}>
        {series.map((s) => (
          <span key={s.name} className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
