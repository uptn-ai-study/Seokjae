import styles from './charts.module.css';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/**
 * 경량 가로 바 차트 (SVG 미사용, 순수 CSS). 음수 값 지원.
 */
export function BarChart({
  data,
  format = (v) => String(v),
  title,
}: {
  data: BarDatum[];
  format?: (v: number) => string;
  title: string;
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className={styles.barChart} role="img" aria-label={title}>
      {data.map((d) => (
        <div key={d.label} className={styles.barRow}>
          <span className={styles.barLabel}>{d.label}</span>
          <span className={styles.barTrack}>
            <span
              className={`${styles.bar} ${d.value < 0 ? styles.barNeg : ''}`}
              style={{
                width: `${(Math.abs(d.value) / max) * 100}%`,
                background: d.color,
              }}
            />
          </span>
          <span className={styles.barValue}>{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
