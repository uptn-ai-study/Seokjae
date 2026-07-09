import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { fmtDate, fmtDateFull } from '../../lib/format';
import { GameCard } from './GameCard';
import styles from './SchedulePage.module.css';

/** 경기 일정·결과: 경기가 있었던 날짜 사이를 이전/다음으로 이동 */
export function SchedulePage() {
  const { data, error, loading, retry } = useData(() => dataClient.games());
  const [params, setParams] = useSearchParams();

  const dates = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.games.map((g) => g.date))].sort();
  }, [data]);

  const selected = useMemo(() => {
    const q = params.get('date');
    if (q && dates.includes(q)) return q;
    // 기본: 가장 최근 경기가 있는 날
    return dates[dates.length - 1] ?? null;
  }, [params, dates]);

  if (loading) return <Loading label="경기 일정을 불러오는 중" />;
  if (error) return <ErrorBox error={error} onRetry={retry} />;
  if (!data || !selected) return <Empty>수집된 경기가 없습니다.</Empty>;

  const idx = dates.indexOf(selected);
  const games = data.games.filter((g) => g.date === selected);
  const move = (to: string | undefined) => to && setParams({ date: to });

  return (
    <div>
      <h1 className="page-title">경기 일정·결과</h1>
      <div className={styles.nav}>
        <button
          type="button"
          onClick={() => move(dates[idx - 1])}
          disabled={idx <= 0}
          aria-label="이전 경기일"
        >
          ← 이전
        </button>
        <div className={styles.date}>
          <strong>{fmtDate(selected)}</strong>
          <span>{fmtDateFull(selected)}</span>
        </div>
        <button
          type="button"
          onClick={() => move(dates[idx + 1])}
          disabled={idx >= dates.length - 1}
          aria-label="다음 경기일"
        >
          다음 →
        </button>
      </div>
      {games.length === 0 ? (
        <Empty>이 날짜에는 경기가 없습니다.</Empty>
      ) : (
        <div className={styles.grid}>
          {games.map((g) => (
            <GameCard key={g.gameId} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
