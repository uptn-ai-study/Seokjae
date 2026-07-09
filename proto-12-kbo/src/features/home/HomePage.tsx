import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { TeamBadge } from '../../components/common/TeamBadge';
import { LineChart } from '../../components/charts/LineChart';
import { fmtDate, fmtGamesBehind, fmtRate } from '../../lib/format';
import { teamInfo } from '../../lib/teams';
import { GameCard } from '../schedule/GameCard';
import styles from './HomePage.module.css';

/** 홈: 최근 경기 결과 + 순위 요약 + 상위권 승률 추이 */
export function HomePage() {
  const games = useData(() => dataClient.games());
  const standings = useData(() => dataClient.standings());

  const latest = useMemo(() => {
    if (!games.data) return null;
    const finishedDates = [
      ...new Set(games.data.games.filter((g) => g.status !== 'scheduled').map((g) => g.date)),
    ].sort();
    const date = finishedDates[finishedDates.length - 1];
    if (!date) return null;
    return { date, games: games.data.games.filter((g) => g.date === date) };
  }, [games.data]);

  /** 상위 3팀의 날짜별 누적 승률 추이 */
  const trend = useMemo(() => {
    if (!games.data || !standings.data) return null;
    const topTeams = standings.data.standings.slice(0, 3);
    const finished = games.data.games
      .filter((g) => g.seriesId === 0 && g.status === 'finished')
      .sort((a, b) => a.date.localeCompare(b.date));
    const dates = [...new Set(finished.map((g) => g.date))];
    if (dates.length < 2) return null;
    const series = topTeams.map((t) => {
      let w = 0;
      let l = 0;
      const points: number[] = [];
      for (const date of dates) {
        for (const g of finished) {
          if (g.date !== date) continue;
          const isAway = g.away.teamId === t.teamId;
          const isHome = g.home.teamId === t.teamId;
          if (!isAway && !isHome) continue;
          const my = isAway ? g.away.score! : g.home.score!;
          const opp = isAway ? g.home.score! : g.away.score!;
          if (my > opp) w++;
          else if (my < opp) l++;
        }
        points.push(w + l > 0 ? w / (w + l) : 0);
      }
      return { name: t.teamName, color: teamInfo(t.teamId).color, points };
    });
    return {
      series,
      xLabels: dates.map((d) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`),
    };
  }, [games.data, standings.data]);

  if (games.loading || standings.loading) return <Loading label="요약을 불러오는 중" />;
  if (games.error) return <ErrorBox error={games.error} onRetry={games.retry} />;
  if (standings.error) return <ErrorBox error={standings.error} onRetry={standings.retry} />;

  return (
    <div>
      <section>
        <h2 className="section-title">
          최근 경기 {latest && <small className={styles.date}>{fmtDate(latest.date)}</small>}
          <Link to="/schedule">전체 일정 →</Link>
        </h2>
        {latest ? (
          <div className={styles.games}>
            {latest.games.map((g) => (
              <GameCard key={g.gameId} game={g} />
            ))}
          </div>
        ) : (
          <Empty>최근 경기가 없습니다.</Empty>
        )}
      </section>

      <section>
        <h2 className="section-title">
          팀 순위 <Link to="/standings">전체 순위 →</Link>
        </h2>
        <ol className={styles.rankList}>
          {standings.data?.standings.slice(0, 5).map((t) => (
            <li key={t.teamId}>
              <span className={styles.rankNo}>{t.rank}</span>
              <TeamBadge teamId={t.teamId} teamName={t.teamName} />
              <span className={styles.rankStat}>
                {t.wins}승 {t.losses}패{t.ties > 0 ? ` ${t.ties}무` : ''}
              </span>
              <span className={styles.rankPct}>{fmtRate(t.winPct)}</span>
              <span className={styles.rankGb}>{fmtGamesBehind(t.gamesBehind)}</span>
            </li>
          ))}
        </ol>
      </section>

      {trend && (
        <section>
          <h2 className="section-title">상위 3팀 승률 추이</h2>
          <LineChart
            title="상위 3팀 누적 승률 추이"
            series={trend.series}
            xLabels={trend.xLabels}
            yFormat={(v) => v.toFixed(3).replace(/^0\./, '.')}
          />
        </section>
      )}
    </div>
  );
}
