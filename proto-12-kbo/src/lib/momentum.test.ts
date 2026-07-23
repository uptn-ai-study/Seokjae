import { describe, expect, it } from 'vitest';
import { computeMomentum, predictGames } from './momentum';
import type { StandingRow, TeamNews, UpcomingGame } from '../types/kbo';

function team(teamId: string, netScore: number): TeamNews {
  return {
    teamId, teamName: teamId, articleCount: 0, posArticles: 0, negArticles: 0, neuArticles: 0,
    positiveScore: Math.max(0, netScore), negativeScore: Math.max(0, -netScore), netScore,
    topPositiveKeywords: [], topNegativeKeywords: [], summary: '', articles: [],
  };
}
function standing(teamId: string, w: number, l: number): StandingRow {
  return {
    rank: 1, teamId, teamName: teamId, games: w + l, wins: w, losses: l, ties: 0,
    winPct: w / (w + l), gamesBehind: 0, last10: { wins: w, losses: l, ties: 0 },
    streak: '', runsScored: 0, runsAllowed: 0,
  };
}

describe('모멘텀', () => {
  it('폼·심리가 좋을수록 모멘텀이 높다', () => {
    const news = [team('A', 20), team('B', -20)];
    const stand = [standing('A', 8, 2), standing('B', 2, 8)];
    const m = computeMomentum(news, stand);
    expect(m.get('A')!.momentum).toBeGreaterThan(m.get('B')!.momentum);
    expect(m.get('A')!.sentimentScore).toBeCloseTo(1, 5); // net 20 == maxAbs
    expect(m.get('A')!.formScore).toBeCloseTo(0.6, 5); // (8-2)/10
  });

  it('예측: 강팀 홈이 확률 우세, 홈+원정 합은 100%', () => {
    const news = [team('A', 20), team('B', -20)];
    const stand = [standing('A', 8, 2), standing('B', 2, 8)];
    const m = computeMomentum(news, stand);
    const game: UpcomingGame = {
      gameId: 'g1', awayTeamId: 'B', homeTeamId: 'A', awayTeamName: 'B', homeTeamName: 'A', status: 'scheduled',
    };
    const [p] = predictGames([game], m);
    expect(p.homeWinPct).toBeGreaterThan(50);
    expect(p.favoredTeamId).toBe('A');
    expect(p.homeWinPct + (100 - p.homeWinPct)).toBe(100);
  });
});
