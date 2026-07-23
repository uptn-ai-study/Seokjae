/**
 * 뉴스 심리 + 최근 경기 폼을 결합한 "모멘텀 지수"와 다음 경기 예측(실험적).
 *
 * ⚠ 이 지표는 재미로 보는 실험적 값이다. 사전 기반 감성은 문맥·반어를 반영하지 못하고,
 *   같은 경기 기사가 양 팀에 잡혀 승자 키워드가 패자에게도 반영되는 한계가 있다.
 *   실제 승부 예측이 아니다.
 */
import type { StandingRow, TeamNews, UpcomingGame } from '../types/kbo';

export interface TeamMomentum {
  teamId: string;
  teamName: string;
  formScore: number; // -1..1 (최근 10경기)
  sentimentScore: number; // -1..1 (뉴스 net 정규화)
  momentum: number; // -1..1 (form·sentiment 결합)
  netNews: number; // 원본 net (표시용)
}

/** 최근 10경기 폼 → -1..1 */
function formOf(row: StandingRow | undefined): number {
  if (!row) return 0;
  const decided = row.last10.wins + row.last10.losses;
  if (decided > 0) return (row.last10.wins - row.last10.losses) / decided;
  return row.winPct * 2 - 1;
}

export function computeMomentum(
  teamsNews: TeamNews[],
  standings: StandingRow[],
): Map<string, TeamMomentum> {
  const standByTeam = new Map(standings.map((s) => [s.teamId, s]));
  const maxAbsNet = Math.max(1, ...teamsNews.map((t) => Math.abs(t.netScore)));
  const out = new Map<string, TeamMomentum>();
  for (const t of teamsNews) {
    const formScore = round(formOf(standByTeam.get(t.teamId)));
    const sentimentScore = round(t.netScore / maxAbsNet);
    // 폼·심리 동일 가중
    const momentum = round(0.5 * formScore + 0.5 * sentimentScore);
    out.set(t.teamId, {
      teamId: t.teamId,
      teamName: t.teamName,
      formScore,
      sentimentScore,
      momentum,
      netNews: t.netScore,
    });
  }
  return out;
}

export interface Prediction {
  gameId: string;
  home: TeamMomentum;
  away: TeamMomentum;
  favoredTeamId: string;
  homeWinPct: number; // 0..100 (홈 기준, 실험적)
}

/** 다음 경기 예측(실험적): 모멘텀 차 + 소폭 홈 이점 → 로지스틱 확률 */
export function predictGames(
  games: UpcomingGame[],
  momentum: Map<string, TeamMomentum>,
): Prediction[] {
  const HOME_EDGE = 0.15; // 홈 어드밴티지(경험적 소폭)
  const K = 2.2; // 로지스틱 민감도
  const preds: Prediction[] = [];
  for (const g of games) {
    const home = momentum.get(g.homeTeamId);
    const away = momentum.get(g.awayTeamId);
    if (!home || !away) continue;
    const diff = home.momentum - away.momentum + HOME_EDGE;
    const homeWinPct = Math.round((1 / (1 + Math.exp(-K * diff))) * 100);
    preds.push({
      gameId: g.gameId,
      home,
      away,
      favoredTeamId: homeWinPct >= 50 ? g.homeTeamId : g.awayTeamId,
      homeWinPct,
    });
  }
  return preds;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
