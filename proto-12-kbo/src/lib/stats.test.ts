import { describe, expect, it } from 'vitest';
import {
  battingAverage,
  era,
  gamesBehind,
  onBasePercentage,
  ops,
  parseInnings,
  sluggingPercentage,
  whip,
  winPct,
} from './stats';

describe('타자 지표', () => {
  it('타율 = 안타/타수', () => {
    expect(battingAverage(116, 320)).toBe(0.363);
    expect(battingAverage(0, 0)).toBeNull();
  });
  it('출루율', () => {
    // (100+40+5) / (300+40+5+5) = 145/350 ≈ 0.414
    expect(onBasePercentage(100, 40, 5, 300, 5)).toBe(0.414);
  });
  it('장타율/OPS', () => {
    expect(sluggingPercentage(171, 332)).toBe(0.515);
    expect(ops(0.4, 0.5)).toBe(0.9);
    expect(ops(null, 0.5)).toBeNull();
  });
});

describe('투수 지표', () => {
  it('ERA = 자책×9/이닝', () => {
    expect(era(30, 90)).toBe(3);
    // 100⅔ 이닝 25자책 → 225 / 100.667 ≈ 2.24
    expect(era(25, 100 + 2 / 3)).toBe(2.24);
    expect(era(1, 0)).toBeNull();
  });
  it('WHIP = (볼넷+피안타)/이닝', () => {
    expect(whip(30, 80, 100)).toBe(1.1);
  });
  it('이닝 문자열 파싱', () => {
    expect(parseInnings('45 1/3')).toBeCloseTo(45.333, 2);
    expect(parseInnings('2/3')).toBeCloseTo(0.667, 2);
    expect(parseInnings('88')).toBe(88);
    expect(parseInnings('abc')).toBeNull();
  });
});

describe('팀 지표', () => {
  it('승률은 무승부 제외', () => {
    expect(winPct(50, 30)).toBe(0.625);
    expect(winPct(0, 0)).toBeNull();
  });
  it('게임차', () => {
    expect(gamesBehind(55, 25, 50, 30)).toBe(5);
    expect(gamesBehind(55, 25, 55, 25)).toBe(0);
  });
});
