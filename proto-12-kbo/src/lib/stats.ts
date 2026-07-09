/** 파생 지표 계산. 수집값이 비어 있을 때 화면에서 재계산하는 용도. */

const round = (v: number, digits: number) => {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
};

/** 타율 = 안타 / 타수 */
export function battingAverage(hits: number, atBats: number): number | null {
  if (atBats <= 0) return null;
  return round(hits / atBats, 3);
}

/** 출루율 = (안타+볼넷+사구) / (타수+볼넷+사구+희생플라이) */
export function onBasePercentage(
  hits: number,
  walks: number,
  hitByPitch: number,
  atBats: number,
  sacFlies: number,
): number | null {
  const denom = atBats + walks + hitByPitch + sacFlies;
  if (denom <= 0) return null;
  return round((hits + walks + hitByPitch) / denom, 3);
}

/** 장타율 = 루타 / 타수 */
export function sluggingPercentage(totalBases: number, atBats: number): number | null {
  if (atBats <= 0) return null;
  return round(totalBases / atBats, 3);
}

/** OPS = 출루율 + 장타율 */
export function ops(obp: number | null, slg: number | null): number | null {
  if (obp == null || slg == null) return null;
  return round(obp + slg, 3);
}

/** 평균자책점 = 자책점 × 9 / 이닝 */
export function era(earnedRuns: number, inningsPitched: number): number | null {
  if (inningsPitched <= 0) return null;
  return round((earnedRuns * 9) / inningsPitched, 2);
}

/** WHIP = (볼넷+피안타) / 이닝 */
export function whip(walks: number, hits: number, inningsPitched: number): number | null {
  if (inningsPitched <= 0) return null;
  return round((walks + hits) / inningsPitched, 2);
}

/** 승률 = 승 / (승+패). 무승부 제외(KBO 방식) */
export function winPct(wins: number, losses: number): number | null {
  const decided = wins + losses;
  if (decided <= 0) return null;
  return round(wins / decided, 3);
}

/** 게임차 = ((선두 승 - 팀 승) + (팀 패 - 선두 패)) / 2 */
export function gamesBehind(
  leaderWins: number,
  leaderLosses: number,
  wins: number,
  losses: number,
): number {
  return round((leaderWins - wins + (losses - leaderLosses)) / 2, 1);
}

/** "45 1/3" 형태의 이닝 문자열 → 소수 이닝 */
export function parseInnings(text: string): number | null {
  const m = text.trim().match(/^(\d+)?\s*(?:(\d)\/3)?$/);
  if (!m || (m[1] == null && m[2] == null)) return null;
  return Number(m[1] ?? 0) + (m[2] ? Number(m[2]) / 3 : 0);
}
