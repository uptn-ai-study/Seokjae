/**
 * 팀 단위 파생 통계 — 모두 이미 수집된 games 데이터에서 계산한다(추가 크롤링 없음).
 * 상대 전적 / 월별·홈원정 스플릿 / 일자별 순위 변동.
 */
import type { Game } from '../types/kbo';

/** 정규시즌 완료 경기만 (점수 확정) */
export function regularFinished(games: Game[]): Game[] {
  return games.filter(
    (g) => g.seriesId === 0 && g.status === 'finished' && g.away.score != null && g.home.score != null,
  );
}

export interface Record {
  wins: number;
  losses: number;
  ties: number;
  games: number;
  winPct: number | null;
}

function emptyRecord(): Record {
  return { wins: 0, losses: 0, ties: 0, games: 0, winPct: null };
}

function finalize(r: Record): Record {
  const decided = r.wins + r.losses;
  return { ...r, winPct: decided > 0 ? Math.round((r.wins / decided) * 1000) / 1000 : null };
}

/** 한 경기에서 teamId 관점의 결과. 해당 팀 경기가 아니면 null */
function resultFor(g: Game, teamId: string): 'W' | 'L' | 'T' | null {
  const isHome = g.home.teamId === teamId;
  const isAway = g.away.teamId === teamId;
  if (!isHome && !isAway) return null;
  const my = (isHome ? g.home.score : g.away.score) as number;
  const opp = (isHome ? g.away.score : g.home.score) as number;
  return my > opp ? 'W' : my < opp ? 'L' : 'T';
}

function apply(r: Record, res: 'W' | 'L' | 'T') {
  r.games++;
  if (res === 'W') r.wins++;
  else if (res === 'L') r.losses++;
  else r.ties++;
}

export interface HeadToHead extends Record {
  oppTeamId: string;
  oppTeamName: string;
}

/** 상대 팀별 전적 */
export function headToHead(games: Game[], teamId: string): HeadToHead[] {
  const byOpp = new Map<string, HeadToHead>();
  for (const g of regularFinished(games)) {
    const res = resultFor(g, teamId);
    if (!res) continue;
    const isHome = g.home.teamId === teamId;
    const opp = isHome ? g.away : g.home;
    if (!byOpp.has(opp.teamId)) {
      byOpp.set(opp.teamId, { ...emptyRecord(), oppTeamId: opp.teamId, oppTeamName: opp.teamName });
    }
    apply(byOpp.get(opp.teamId)!, res);
  }
  return [...byOpp.values()]
    .map((r) => ({ ...r, ...finalize(r) }))
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0));
}

export interface SplitRow extends Record {
  label: string;
}

/** 월별 성적 */
export function monthlySplits(games: Game[], teamId: string): SplitRow[] {
  const byMonth = new Map<string, Record>();
  for (const g of regularFinished(games)) {
    const res = resultFor(g, teamId);
    if (!res) continue;
    const month = g.date.slice(4, 6);
    if (!byMonth.has(month)) byMonth.set(month, emptyRecord());
    apply(byMonth.get(month)!, res);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, r]) => ({ label: `${Number(month)}월`, ...finalize(r) }));
}

/** 홈/원정 스플릿 */
export function homeAwaySplits(games: Game[], teamId: string): SplitRow[] {
  const home = emptyRecord();
  const away = emptyRecord();
  for (const g of regularFinished(games)) {
    const res = resultFor(g, teamId);
    if (!res) continue;
    apply(g.home.teamId === teamId ? home : away, res);
  }
  return [
    { label: '홈', ...finalize(home) },
    { label: '원정', ...finalize(away) },
  ];
}

/** 최근 N경기 (최신순) */
export function recentGames(games: Game[], teamId: string, n = 10): Game[] {
  return regularFinished(games)
    .filter((g) => g.home.teamId === teamId || g.away.teamId === teamId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export interface RankHistory {
  dates: string[]; // YYYYMMDD
  ranks: Map<string, number[]>; // teamId -> 날짜별 순위(1이 1위)
}

/**
 * 일자별 순위 변동. 각 날짜까지의 누적 승률로 순위를 매긴다.
 * 표본이 적은 초반 흔들림을 줄이려 최소 minGames 경기 이후부터 산출.
 */
export function rankHistory(games: Game[], minGames = 10): RankHistory {
  const finished = regularFinished(games).sort((a, b) => a.date.localeCompare(b.date));
  const cum = new Map<string, { w: number; l: number }>();
  const dates: string[] = [];
  const ranks = new Map<string, number[]>();

  const byDate = new Map<string, Game[]>();
  for (const g of finished) {
    if (!byDate.has(g.date)) byDate.set(g.date, []);
    byDate.get(g.date)!.push(g);
  }

  for (const [date, dayGames] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const g of dayGames) {
      for (const side of [g.home, g.away]) {
        if (!cum.has(side.teamId)) cum.set(side.teamId, { w: 0, l: 0 });
      }
      const res = resultFor(g, g.home.teamId);
      if (res === 'W') {
        cum.get(g.home.teamId)!.w++;
        cum.get(g.away.teamId)!.l++;
      } else if (res === 'L') {
        cum.get(g.home.teamId)!.l++;
        cum.get(g.away.teamId)!.w++;
      }
    }
    const entries = [...cum.entries()];
    const enough = entries.every(([, r]) => r.w + r.l >= minGames);
    if (!enough) continue;

    const sorted = entries
      .map(([teamId, r]) => ({ teamId, pct: r.w + r.l > 0 ? r.w / (r.w + r.l) : 0 }))
      .sort((a, b) => b.pct - a.pct);

    dates.push(date);
    sorted.forEach((s, i) => {
      if (!ranks.has(s.teamId)) ranks.set(s.teamId, []);
      ranks.get(s.teamId)!.push(i + 1);
    });
  }
  return { dates, ranks };
}
