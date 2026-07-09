import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { DataTable, type Column } from '../../components/common/DataTable';
import { TeamBadge } from '../../components/common/TeamBadge';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { fmtEra, fmtInnings, fmtNum, fmtRate } from '../../lib/format';
import { TEAMS } from '../../lib/teams';
import type { Hitter, Pitcher } from '../../types/kbo';
import styles from './PlayersPage.module.css';

const hitterColumns: Column<Hitter>[] = [
  { key: 'name', label: '선수', align: 'left', sortValue: (r) => r.name, render: (r) => <strong>{r.name}</strong> },
  {
    key: 'team', label: '팀', align: 'left', sortValue: (r) => r.teamName,
    render: (r) => <TeamBadge teamId={r.teamId} teamName={r.teamName} size="sm" />,
  },
  { key: 'avg', label: 'AVG', glossaryKey: 'avg', highlightTop: true, sortValue: (r) => r.avg, render: (r) => fmtRate(r.avg) },
  { key: 'g', label: 'G', sortValue: (r) => r.g, render: (r) => fmtNum(r.g) },
  { key: 'pa', label: 'PA', glossaryKey: 'pa', sortValue: (r) => r.pa, render: (r) => fmtNum(r.pa) },
  { key: 'r', label: 'R', glossaryKey: 'r', sortValue: (r) => r.r, render: (r) => fmtNum(r.r) },
  { key: 'h', label: 'H', glossaryKey: 'h', highlightTop: true, sortValue: (r) => r.h, render: (r) => fmtNum(r.h) },
  { key: 'hr', label: 'HR', glossaryKey: 'hr', highlightTop: true, sortValue: (r) => r.hr, render: (r) => fmtNum(r.hr) },
  { key: 'rbi', label: 'RBI', glossaryKey: 'rbi', highlightTop: true, sortValue: (r) => r.rbi, render: (r) => fmtNum(r.rbi) },
  { key: 'bb', label: 'BB', glossaryKey: 'bb', sortValue: (r) => r.bb, render: (r) => fmtNum(r.bb) },
  { key: 'so', label: 'SO', glossaryKey: 'so', sortValue: (r) => r.so, lowerIsBetter: true, render: (r) => fmtNum(r.so) },
  { key: 'obp', label: 'OBP', glossaryKey: 'obp', highlightTop: true, sortValue: (r) => r.obp, render: (r) => fmtRate(r.obp) },
  { key: 'slg', label: 'SLG', glossaryKey: 'slg', highlightTop: true, sortValue: (r) => r.slg, render: (r) => fmtRate(r.slg) },
  { key: 'ops', label: 'OPS', glossaryKey: 'ops', highlightTop: true, sortValue: (r) => r.ops, render: (r) => fmtRate(r.ops) },
  { key: 'rispAvg', label: '득타율', glossaryKey: 'risp', sortValue: (r) => r.rispAvg, render: (r) => fmtRate(r.rispAvg) },
];

const pitcherColumns: Column<Pitcher>[] = [
  { key: 'name', label: '선수', align: 'left', sortValue: (r) => r.name, render: (r) => <strong>{r.name}</strong> },
  {
    key: 'team', label: '팀', align: 'left', sortValue: (r) => r.teamName,
    render: (r) => <TeamBadge teamId={r.teamId} teamName={r.teamName} size="sm" />,
  },
  { key: 'era', label: 'ERA', glossaryKey: 'era', highlightTop: true, lowerIsBetter: true, sortValue: (r) => r.era, render: (r) => fmtEra(r.era) },
  { key: 'g', label: 'G', sortValue: (r) => r.g, render: (r) => fmtNum(r.g) },
  { key: 'w', label: 'W', glossaryKey: 'w', highlightTop: true, sortValue: (r) => r.w, render: (r) => fmtNum(r.w) },
  { key: 'l', label: 'L', glossaryKey: 'l', lowerIsBetter: true, sortValue: (r) => r.l, render: (r) => fmtNum(r.l) },
  { key: 'sv', label: 'SV', glossaryKey: 'sv', sortValue: (r) => r.sv, render: (r) => fmtNum(r.sv) },
  { key: 'hld', label: 'HLD', glossaryKey: 'hld', sortValue: (r) => r.hld, render: (r) => fmtNum(r.hld) },
  { key: 'ip', label: 'IP', glossaryKey: 'ip', sortValue: (r) => r.ip, render: (r) => fmtInnings(r.ip) },
  { key: 'so', label: 'SO', glossaryKey: 'so', highlightTop: true, sortValue: (r) => r.so, render: (r) => fmtNum(r.so) },
  { key: 'qs', label: 'QS', glossaryKey: 'qs', highlightTop: true, sortValue: (r) => r.qs, render: (r) => fmtNum(r.qs) },
  { key: 'whip', label: 'WHIP', glossaryKey: 'whip', highlightTop: true, lowerIsBetter: true, sortValue: (r) => r.whip, render: (r) => fmtEra(r.whip) },
  { key: 'oavg', label: 'OAVG', glossaryKey: 'oavg', lowerIsBetter: true, sortValue: (r) => r.oavg, render: (r) => fmtRate(r.oavg) },
];

type Tab = 'hitters' | 'pitchers';

export function PlayersPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'pitchers' ? 'pitchers' : 'hitters';
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');

  const hitters = useData(() => dataClient.hitters());
  const pitchers = useData(() => dataClient.pitchers());
  const active = tab === 'hitters' ? hitters : pitchers;

  const rows = useMemo(() => {
    const list: (Hitter | Pitcher)[] =
      tab === 'hitters' ? (hitters.data?.hitters ?? []) : (pitchers.data?.pitchers ?? []);
    return list.filter(
      (r) =>
        (!team || r.teamId === team) &&
        (!query || r.name.toLowerCase().includes(query.toLowerCase())),
    );
  }, [tab, hitters.data, pitchers.data, team, query]);

  return (
    <div>
      <h1 className="page-title">선수 기록</h1>
      <div className={styles.tabs} role="tablist" aria-label="기록 종류">
        {(
          [
            ['hitters', '타자'],
            ['pitchers', '투수'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? styles.tabActive : styles.tab}
            onClick={() => setParams({ tab: key })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.filters}>
        <input
          type="search"
          placeholder="선수 이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="선수 이름 검색"
        />
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="팀 필터">
          <option value="">전체 팀</option>
          {Object.values(TEAMS).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {active.loading ? (
        <Loading label="선수 기록을 불러오는 중" />
      ) : active.error ? (
        <ErrorBox error={active.error} onRetry={active.retry} />
      ) : rows.length === 0 ? (
        <Empty>조건에 맞는 선수가 없습니다.</Empty>
      ) : tab === 'hitters' ? (
        <DataTable
          columns={hitterColumns}
          rows={rows as Hitter[]}
          rowKey={(r) => r.playerId ?? r.name}
          defaultSortKey="avg"
          caption="타자 기록"
        />
      ) : (
        <DataTable
          columns={pitcherColumns}
          rows={rows as Pitcher[]}
          rowKey={(r) => r.playerId ?? r.name}
          defaultSortKey="era"
          defaultSortDesc={false}
          caption="투수 기록"
        />
      )}
      <p className={styles.note}>
        * 규정 타석/이닝을 채운 선수만 표시됩니다. 지표 옆 <strong>?</strong> 를 누르면 설명이
        나옵니다.
      </p>
    </div>
  );
}
