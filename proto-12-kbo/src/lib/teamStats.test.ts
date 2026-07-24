import { describe, expect, it } from 'vitest';
import { headToHead, homeAwaySplits, monthlySplits, rankHistory, recentGames } from './teamStats';
import type { Game } from '../types/kbo';

function game(date: string, awayId: string, awayScore: number, homeId: string, homeScore: number): Game {
  return {
    gameId: `${date}${awayId}${homeId}0`,
    date,
    time: '18:30',
    season: 2026,
    seriesId: 0,
    seriesName: '정규경기',
    stadium: '테스트',
    status: 'finished',
    cancelReason: '',
    away: { teamId: awayId, teamName: awayId, score: awayScore },
    home: { teamId: homeId, teamName: homeId, score: homeScore },
    winPitcher: null,
    losePitcher: null,
    savePitcher: null,
    hasBoxscore: false,
  };
}

// A: 홈 2승, 원정 1패, LG 상대 2승 1패
const games: Game[] = [
  game('20260401', 'LG', 1, 'A', 5), // A 홈 승
  game('20260402', 'LG', 3, 'A', 2), // A 홈 패
  game('20260503', 'A', 7, 'LG', 4), // A 원정 승
];

describe('상대 전적', () => {
  it('상대별 승패를 집계한다', () => {
    const [lg] = headToHead(games, 'A');
    expect(lg.oppTeamId).toBe('LG');
    expect(lg.wins).toBe(2);
    expect(lg.losses).toBe(1);
    expect(lg.games).toBe(3);
    expect(lg.winPct).toBeCloseTo(0.667, 2);
  });

  it('무관한 팀 경기는 제외한다', () => {
    const withOther = [...games, game('20260405', 'KT', 1, 'NC', 2)];
    expect(headToHead(withOther, 'A')).toHaveLength(1);
  });
});

describe('스플릿', () => {
  it('월별로 나눈다', () => {
    const months = monthlySplits(games, 'A');
    expect(months.map((m) => m.label)).toEqual(['4월', '5월']);
    expect(months[0]).toMatchObject({ wins: 1, losses: 1 });
    expect(months[1]).toMatchObject({ wins: 1, losses: 0 });
  });

  it('홈/원정을 나눈다', () => {
    const [home, away] = homeAwaySplits(games, 'A');
    expect(home).toMatchObject({ label: '홈', wins: 1, losses: 1 });
    expect(away).toMatchObject({ label: '원정', wins: 1, losses: 0 });
  });
});

describe('최근 경기', () => {
  it('최신순으로 n경기를 준다', () => {
    const r = recentGames(games, 'A', 2);
    expect(r).toHaveLength(2);
    expect(r[0].date).toBe('20260503');
  });
});

describe('순위 변동', () => {
  it('표본이 부족하면 빈 결과', () => {
    expect(rankHistory(games, 10).dates).toHaveLength(0);
  });

  it('minGames 를 낮추면 승률순 순위를 낸다', () => {
    const hist = rankHistory(games, 1);
    expect(hist.dates.length).toBeGreaterThan(0);
    // 마지막 시점: A 2승1패(.667) > LG 1승2패(.333)
    const last = hist.dates.length - 1;
    expect(hist.ranks.get('A')![last]).toBe(1);
    expect(hist.ranks.get('LG')![last]).toBe(2);
  });
});
