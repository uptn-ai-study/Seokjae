import { useMemo, useState, type ReactNode } from 'react';
import styles from './DataTable.module.css';
import { StatLabel } from '../glossary/StatLabel';

export interface Column<T> {
  key: string;
  label: string;
  /** glossary 키. 지정하면 헤더에 용어 툴팁이 붙는다 */
  glossaryKey?: string;
  align?: 'left' | 'right' | 'center';
  /** 정렬용 값. 없으면 정렬 비활성 */
  sortValue?: (row: T) => number | string | null;
  render: (row: T, index: number) => ReactNode;
  /** true 면 컬럼 내 상위 3개 값을 강조 */
  highlightTop?: boolean;
  /** 강조 판단 시 낮을수록 좋은 지표인지 */
  lowerIsBetter?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** 첫 열 고정(모바일 가로 스크롤 대응) */
  stickyFirst?: boolean;
  defaultSortKey?: string;
  defaultSortDesc?: boolean;
  caption?: string;
  onRowClick?: (row: T) => void;
}

/**
 * 반응형 정렬 테이블.
 * - 가로 스크롤 컨테이너 + (옵션) sticky 첫 열로 320px 에서도 깨지지 않음
 * - 헤더 클릭/엔터로 정렬, aria-sort 표기
 * - highlightTop 컬럼은 상위 3개 값을 색으로 강조
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  stickyFirst = true,
  defaultSortKey,
  defaultSortDesc = true,
  caption,
  onRowClick,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [desc, setDesc] = useState(defaultSortDesc);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'ko');
      return desc ? -cmp : cmp;
    });
  }, [rows, columns, sortKey, desc]);

  const topValues = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const col of columns) {
      if (!col.highlightTop || !col.sortValue) continue;
      const values = rows
        .map((r) => col.sortValue!(r))
        .filter((v): v is number => typeof v === 'number');
      const ranked = [...new Set(values)].sort((a, b) =>
        col.lowerIsBetter ? a - b : b - a,
      );
      map.set(col.key, new Set(ranked.slice(0, 3)));
    }
    return map;
  }, [columns, rows]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    if (sortKey === col.key) setDesc((v) => !v);
    else {
      setSortKey(col.key);
      setDesc(!col.lowerIsBetter);
    }
  };

  return (
    <div className={styles.scroller} role="region" aria-label={caption} tabIndex={0}>
      <table className={`${styles.table} ${stickyFirst ? styles.stickyFirst : ''}`}>
        {caption && <caption className={styles.srOnly}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = Boolean(col.sortValue);
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={{ textAlign: col.align ?? 'center' }}
                  aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}
                >
                  {sortable ? (
                    <span className={styles.headerGroup}>
                      <button
                        type="button"
                        className={`${styles.sortBtn} ${active ? styles.sortActive : ''}`}
                        onClick={() => toggleSort(col)}
                      >
                        {col.label}
                        <span aria-hidden="true" className={styles.sortMark}>
                          {active ? (desc ? '▼' : '▲') : ''}
                        </span>
                      </button>
                      {col.glossaryKey && <StatLabel statKey={col.glossaryKey} label="" />}
                    </span>
                  ) : col.glossaryKey ? (
                    <StatLabel statKey={col.glossaryKey} label={col.label} />
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={onRowClick ? styles.clickable : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => {
                const v = col.sortValue?.(row);
                const isTop =
                  col.highlightTop && typeof v === 'number' && topValues.get(col.key)?.has(v);
                return (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align ?? 'center' }}
                    className={isTop ? styles.topValue : undefined}
                  >
                    {col.render(row, i)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
