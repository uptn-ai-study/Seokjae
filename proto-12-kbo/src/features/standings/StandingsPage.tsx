import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { DataTable, type Column } from '../../components/common/DataTable';
import { TeamBadge } from '../../components/common/TeamBadge';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { fmtGamesBehind, fmtRate } from '../../lib/format';
import { teamInfo } from '../../lib/teams';
import { rankHistory } from '../../lib/teamStats';
import type { StandingRow } from '../../types/kbo';

const columns: Column<StandingRow>[] = [
  {
    key: 'rank', label: '순위', sortValue: (r) => r.rank, lowerIsBetter: true,
    render: (r) => <strong>{r.rank}</strong>,
  },
  {
    key: 'team', label: '팀', align: 'left', sortValue: (r) => r.teamName,
    render: (r) => (
      <Link to={`/teams/${r.teamId}`} style={{ display: 'inline-flex' }} title={`${r.teamName} 상세 보기`}>
        <TeamBadge teamId={r.teamId} teamName={r.teamName} />
      </Link>
    ),
  },
  { key: 'games', label: '경기', sortValue: (r) => r.games, render: (r) => r.games },
  { key: 'wins', label: '승', sortValue: (r) => r.wins, render: (r) => r.wins },
  { key: 'losses', label: '패', sortValue: (r) => r.losses, lowerIsBetter: true, render: (r) => r.losses },
  { key: 'ties', label: '무', sortValue: (r) => r.ties, render: (r) => r.ties },
  {
    key: 'winPct', label: '승률', glossaryKey: 'winPct', highlightTop: true,
    sortValue: (r) => r.winPct, render: (r) => fmtRate(r.winPct),
  },
  {
    key: 'gamesBehind', label: '게임차', glossaryKey: 'gamesBehind', lowerIsBetter: true,
    sortValue: (r) => r.gamesBehind, render: (r) => fmtGamesBehind(r.gamesBehind),
  },
  {
    key: 'last10', label: '최근10', glossaryKey: 'last10',
    sortValue: (r) => r.last10.wins,
    render: (r) => `${r.last10.wins}승 ${r.last10.losses}패${r.last10.ties ? ` ${r.last10.ties}무` : ''}`,
  },
  { key: 'streak', label: '연속', glossaryKey: 'streak', render: (r) => r.streak },
  {
    key: 'runDiff', label: '득실차', highlightTop: true,
    sortValue: (r) => r.runsScored - r.runsAllowed,
    render: (r) => {
      const d = r.runsScored - r.runsAllowed;
      return d > 0 ? `+${d}` : String(d);
    },
  },
];

export function StandingsPage() {
  const { data, error, loading, retry } = useData(() => dataClient.standings());
  const games = useData(() => dataClient.games());

  /** 일자별 순위 변동 — 상위권 흐름이 보이도록 현재 상위 5팀만 표시 */
  const rankTrend = useMemo(() => {
    if (!data || !games.data) return null;
    const hist = rankHistory(games.data.games);
    if (hist.dates.length < 2) return null;
    const top = data.standings.slice(0, 5);
    const series = top
      .filter((t) => hist.ranks.has(t.teamId))
      .map((t) => ({
        name: t.teamName,
        color: teamInfo(t.teamId).color,
        points: hist.ranks.get(t.teamId)!,
      }));
    if (!series.length) return null;
    return {
      series,
      xLabels: hist.dates.map((d) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`),
    };
  }, [data, games.data]);

  if (loading) return <Loading label="팀 순위를 불러오는 중" />;
  if (error) return <ErrorBox error={error} onRetry={retry} />;
  if (!data || data.standings.length === 0) return <Empty>순위 데이터가 없습니다.</Empty>;

  return (
    <div>
      <h1 className="page-title">{data.season} 팀 순위</h1>
      <p style={{ color: 'var(--color-text-sub)', fontSize: 'var(--text-sm)' }}>
        정규시즌 {data.basedOnGames}경기 결과 기준 · 헤더를 누르면 정렬 · 팀명을 누르면 상세
      </p>
      <DataTable
        columns={columns}
        rows={data.standings}
        rowKey={(r) => r.teamId}
        defaultSortKey="rank"
        defaultSortDesc={false}
        caption="팀 순위표"
      />
      {rankTrend && (
        <>
          <h2 className="section-title">순위 변동 (상위 5팀)</h2>
          <LineChart
            title="일자별 순위 변동"
            series={rankTrend.series}
            xLabels={rankTrend.xLabels}
            invertY
            yFormat={(v) => `${Math.round(v)}위`}
          />
        </>
      )}

      <h2 className="section-title">팀별 득실차</h2>
      <BarChart
        title="팀별 득실차 차트"
        data={data.standings.map((r) => ({
          label: r.teamName,
          value: r.runsScored - r.runsAllowed,
          color: teamInfo(r.teamId).color,
        }))}
        format={(v) => (v > 0 ? `+${v}` : String(v))}
      />
    </div>
  );
}
