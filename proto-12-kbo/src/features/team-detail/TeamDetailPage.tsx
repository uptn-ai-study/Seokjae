import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { DataTable, type Column } from '../../components/common/DataTable';
import { TeamBadge } from '../../components/common/TeamBadge';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { fmtDate, fmtEra, fmtGamesBehind, fmtInnings, fmtNum, fmtRate } from '../../lib/format';
import { teamInfo } from '../../lib/teams';
import {
  headToHead,
  homeAwaySplits,
  monthlySplits,
  recentGames,
  type HeadToHead,
  type SplitRow,
} from '../../lib/teamStats';
import type { Game, Hitter, Pitcher } from '../../types/kbo';
import styles from './TeamDetailPage.module.css';

const recordText = (r: { wins: number; losses: number; ties: number }) =>
  `${r.wins}승 ${r.losses}패${r.ties > 0 ? ` ${r.ties}무` : ''}`;

const h2hColumns: Column<HeadToHead>[] = [
  {
    key: 'opp', label: '상대', align: 'left', sortValue: (r) => r.oppTeamName,
    render: (r) => (
      <Link to={`/teams/${r.oppTeamId}`} className={styles.teamLink}>
        <TeamBadge teamId={r.oppTeamId} teamName={r.oppTeamName} size="sm" />
      </Link>
    ),
  },
  { key: 'games', label: '경기', sortValue: (r) => r.games, render: (r) => r.games },
  { key: 'record', label: '전적', render: (r) => recordText(r) },
  {
    key: 'winPct', label: '승률', glossaryKey: 'winPct', highlightTop: true,
    sortValue: (r) => r.winPct, render: (r) => fmtRate(r.winPct),
  },
];

const splitColumns: Column<SplitRow>[] = [
  { key: 'label', label: '구분', align: 'left', render: (r) => <strong>{r.label}</strong> },
  { key: 'games', label: '경기', sortValue: (r) => r.games, render: (r) => r.games },
  { key: 'record', label: '전적', render: (r) => recordText(r) },
  {
    key: 'winPct', label: '승률', glossaryKey: 'winPct', highlightTop: true,
    sortValue: (r) => r.winPct, render: (r) => fmtRate(r.winPct),
  },
];

const hitterColumns: Column<Hitter>[] = [
  { key: 'name', label: '선수', align: 'left', sortValue: (r) => r.name, render: (r) => <strong>{r.name}</strong> },
  { key: 'avg', label: 'AVG', glossaryKey: 'avg', highlightTop: true, sortValue: (r) => r.avg, render: (r) => fmtRate(r.avg) },
  { key: 'g', label: 'G', sortValue: (r) => r.g, render: (r) => fmtNum(r.g) },
  { key: 'h', label: 'H', glossaryKey: 'h', sortValue: (r) => r.h, render: (r) => fmtNum(r.h) },
  { key: 'hr', label: 'HR', glossaryKey: 'hr', highlightTop: true, sortValue: (r) => r.hr, render: (r) => fmtNum(r.hr) },
  { key: 'rbi', label: 'RBI', glossaryKey: 'rbi', highlightTop: true, sortValue: (r) => r.rbi, render: (r) => fmtNum(r.rbi) },
  { key: 'ops', label: 'OPS', glossaryKey: 'ops', highlightTop: true, sortValue: (r) => r.ops, render: (r) => fmtRate(r.ops) },
];

const pitcherColumns: Column<Pitcher>[] = [
  { key: 'name', label: '선수', align: 'left', sortValue: (r) => r.name, render: (r) => <strong>{r.name}</strong> },
  { key: 'era', label: 'ERA', glossaryKey: 'era', highlightTop: true, lowerIsBetter: true, sortValue: (r) => r.era, render: (r) => fmtEra(r.era) },
  { key: 'w', label: 'W', glossaryKey: 'w', highlightTop: true, sortValue: (r) => r.w, render: (r) => fmtNum(r.w) },
  { key: 'l', label: 'L', glossaryKey: 'l', lowerIsBetter: true, sortValue: (r) => r.l, render: (r) => fmtNum(r.l) },
  { key: 'ip', label: 'IP', glossaryKey: 'ip', sortValue: (r) => r.ip, render: (r) => fmtInnings(r.ip) },
  { key: 'so', label: 'SO', glossaryKey: 'so', highlightTop: true, sortValue: (r) => r.so, render: (r) => fmtNum(r.so) },
  { key: 'whip', label: 'WHIP', glossaryKey: 'whip', highlightTop: true, lowerIsBetter: true, sortValue: (r) => r.whip, render: (r) => fmtEra(r.whip) },
];

/** 최근 경기 한 줄 */
function GameLine({ g, teamId }: { g: Game; teamId: string }) {
  const isHome = g.home.teamId === teamId;
  const me = isHome ? g.home : g.away;
  const opp = isHome ? g.away : g.home;
  const win = (me.score ?? 0) > (opp.score ?? 0);
  const tie = me.score === opp.score;
  return (
    <li className={styles.gameLine}>
      <span className={styles.gameDate}>{fmtDate(g.date)}</span>
      <span className={styles.gameVs}>{isHome ? 'vs' : '@'}</span>
      <TeamBadge teamId={opp.teamId} teamName={opp.teamName} size="sm" />
      <span className={styles.gameScore}>
        {me.score} : {opp.score}
      </span>
      <span className={`${styles.gameResult} ${tie ? styles.resT : win ? styles.resW : styles.resL}`}>
        {tie ? '무' : win ? '승' : '패'}
      </span>
      {g.hasBoxscore && (
        <Link to={`/games/${g.gameId}`} className={styles.boxLink}>
          기록
        </Link>
      )}
    </li>
  );
}

export function TeamDetailPage() {
  const { teamId = '' } = useParams();
  const games = useData(() => dataClient.games());
  const standings = useData(() => dataClient.standings());
  const hitters = useData(() => dataClient.hitters());
  const pitchers = useData(() => dataClient.pitchers());
  const news = useData(() => dataClient.news());

  const all = games.data?.games ?? [];
  const h2h = useMemo(() => (all.length ? headToHead(all, teamId) : []), [all, teamId]);
  const months = useMemo(() => (all.length ? monthlySplits(all, teamId) : []), [all, teamId]);
  const homeAway = useMemo(() => (all.length ? homeAwaySplits(all, teamId) : []), [all, teamId]);
  const recent = useMemo(() => (all.length ? recentGames(all, teamId, 10) : []), [all, teamId]);

  if (games.loading || standings.loading) return <Loading label="팀 정보를 불러오는 중" />;
  if (games.error) return <ErrorBox error={games.error} onRetry={games.retry} />;

  const row = standings.data?.standings.find((s) => s.teamId === teamId);
  const t = teamInfo(teamId, row?.teamName);
  if (!row) return <Empty>해당 팀 정보를 찾을 수 없습니다.</Empty>;

  const teamHitters = (hitters.data?.hitters ?? []).filter((h) => h.teamId === teamId);
  const teamPitchers = (pitchers.data?.pitchers ?? []).filter((p) => p.teamId === teamId);
  const teamNews = news.data?.teams.find((n) => n.teamId === teamId);

  return (
    <div>
      <Link to="/standings" className={styles.back}>
        ← 순위로
      </Link>

      <div className={styles.hero} style={{ borderTopColor: t.color }}>
        <div className={styles.heroTop}>
          <TeamBadge teamId={teamId} teamName={row.teamName} />
          <span className={styles.fullName}>{t.fullName}</span>
        </div>
        <div className={styles.heroStats}>
          <span>
            <b>{row.rank}</b>위
          </span>
          <span>{recordText(row)}</span>
          <span>
            승률 <b>{fmtRate(row.winPct)}</b>
          </span>
          <span>게임차 {fmtGamesBehind(row.gamesBehind)}</span>
          <span>
            최근10 {row.last10.wins}승 {row.last10.losses}패
          </span>
          <span>
            득실 {row.runsScored - row.runsAllowed > 0 ? '+' : ''}
            {row.runsScored - row.runsAllowed}
          </span>
        </div>
        {teamNews && (
          <p className={styles.newsLine}>
            📰 뉴스 심리{' '}
            <b style={{ color: teamNews.netScore >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}>
              {teamNews.netScore > 0 ? '+' : ''}
              {teamNews.netScore}
            </b>{' '}
            (긍정 {teamNews.posArticles} · 부정 {teamNews.negArticles}) —{' '}
            <Link to="/news" className={styles.newsLink}>
              자세히
            </Link>
          </p>
        )}
      </div>

      <h2 className="section-title">상대 전적</h2>
      {h2h.length === 0 ? (
        <Empty>정규시즌 전적이 없습니다.</Empty>
      ) : (
        <DataTable columns={h2hColumns} rows={h2h} rowKey={(r) => r.oppTeamId} caption="상대 팀별 전적" />
      )}

      <h2 className="section-title">월별 성적</h2>
      {months.length === 0 ? (
        <Empty>월별 기록이 없습니다.</Empty>
      ) : (
        <DataTable columns={splitColumns} rows={months} rowKey={(r) => r.label} caption="월별 성적" />
      )}

      <h2 className="section-title">홈 / 원정</h2>
      <DataTable columns={splitColumns} rows={homeAway} rowKey={(r) => r.label} caption="홈 원정 성적" />

      <h2 className="section-title">최근 10경기</h2>
      {recent.length === 0 ? (
        <Empty>최근 경기가 없습니다.</Empty>
      ) : (
        <ul className={styles.games}>
          {recent.map((g) => (
            <GameLine key={g.gameId} g={g} teamId={teamId} />
          ))}
        </ul>
      )}

      <h2 className="section-title">팀 타자 기록</h2>
      {teamHitters.length === 0 ? (
        <Empty>규정 타석을 채운 타자가 없습니다.</Empty>
      ) : (
        <DataTable
          columns={hitterColumns}
          rows={teamHitters}
          rowKey={(r) => r.playerId ?? r.name}
          defaultSortKey="avg"
          caption="팀 타자 기록"
        />
      )}

      <h2 className="section-title">팀 투수 기록</h2>
      {teamPitchers.length === 0 ? (
        <Empty>규정 이닝을 채운 투수가 없습니다.</Empty>
      ) : (
        <DataTable
          columns={pitcherColumns}
          rows={teamPitchers}
          rowKey={(r) => r.playerId ?? r.name}
          defaultSortKey="era"
          defaultSortDesc={false}
          caption="팀 투수 기록"
        />
      )}
      <p className={styles.note}>* 선수 기록은 규정 타석/이닝을 채운 선수만 표시됩니다.</p>
    </div>
  );
}
