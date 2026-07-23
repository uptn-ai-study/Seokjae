/** 정규화 데이터 공용 타입 (data/schema/*.json 과 대응) */

export type GameStatus = 'scheduled' | 'live' | 'finished' | 'canceled' | 'suspended';

export interface TeamSide {
  teamId: string;
  teamName: string;
  score: number | null;
}

export interface Game {
  gameId: string;
  date: string; // YYYYMMDD
  time: string;
  season: number;
  seriesId: number; // 0 정규 / 1 시범 / 3~5,7 포스트시즌
  seriesName: string;
  stadium: string;
  status: GameStatus;
  cancelReason: string;
  away: TeamSide;
  home: TeamSide;
  winPitcher: string | null;
  losePitcher: string | null;
  savePitcher: string | null;
  hasBoxscore: boolean;
}

export interface GamesFile {
  season: number;
  source: string;
  generatedAt: string;
  games: Game[];
}

export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  gamesBehind: number;
  last10: { wins: number; losses: number; ties: number };
  streak: string;
  runsScored: number;
  runsAllowed: number;
}

export interface StandingsFile {
  season: number;
  generatedAt: string;
  basedOnGames: number;
  standings: StandingRow[];
}

export interface Hitter {
  playerId: string | null;
  name: string;
  teamId: string | null;
  teamName: string;
  avg: number | null;
  g: number | null;
  pa: number | null;
  ab: number | null;
  r: number | null;
  h: number | null;
  h2: number | null;
  h3: number | null;
  hr: number | null;
  tb: number | null;
  rbi: number | null;
  bb: number | null;
  hbp: number | null;
  so: number | null;
  gdp: number | null;
  slg: number | null;
  obp: number | null;
  ops: number | null;
  multiHit: number | null;
  rispAvg: number | null;
}

export interface HittersFile {
  season: number;
  generatedAt: string;
  qualifiedOnly: boolean;
  hitters: Hitter[];
}

export interface Pitcher {
  playerId: string | null;
  name: string;
  teamId: string | null;
  teamName: string;
  era: number | null;
  g: number | null;
  w: number | null;
  l: number | null;
  sv: number | null;
  hld: number | null;
  winPct: number | null;
  ip: number | null;
  h: number | null;
  hr: number | null;
  bb: number | null;
  so: number | null;
  r: number | null;
  er: number | null;
  whip: number | null;
  qs: number | null;
  oavg: number | null;
}

export interface PitchersFile {
  season: number;
  generatedAt: string;
  qualifiedOnly: boolean;
  pitchers: Pitcher[];
}

/** 박스스코어 테이블(문자열 매트릭스: 원본 표 구조 유지) */
export interface Matrix {
  headers: string[][];
  rows: string[][];
}

export interface Boxscore {
  gameId: string;
  meta: {
    stadium: string;
    crowd: string;
    startTime: string;
    endTime: string;
    duration: string;
    awayFullName: string;
    homeFullName: string;
  };
  lineScore: { innings: Matrix; totals: Matrix; result: Matrix };
  hitters: { lineup: Matrix; byInning: Matrix; totals: Matrix }[];
  pitchers: Matrix[];
  etc: Matrix;
}

/** 뉴스 심리 데이터 (news/<season>.json) */
export interface NewsArticle {
  title: string;
  outlet: string;
  url: string;
  publishedAt: string | null;
  score: number;
  label: 'pos' | 'neg' | 'neu';
}

export interface TeamNews {
  teamId: string;
  teamName: string;
  articleCount: number;
  posArticles: number;
  negArticles: number;
  neuArticles: number;
  positiveScore: number;
  negativeScore: number;
  netScore: number;
  topPositiveKeywords: string[];
  topNegativeKeywords: string[];
  summary: string;
  articles: NewsArticle[];
}

export interface UpcomingGame {
  gameId: string;
  awayTeamId: string;
  homeTeamId: string;
  awayTeamName: string;
  homeTeamName: string;
  status: GameStatus;
}

export interface NewsFile {
  season: number;
  generatedAt: string;
  asOf: string; // YYYYMMDD
  window: { days: number; from: string; to: string };
  method: string;
  disclaimer: string;
  outlets: { category: string; names: string[] }[];
  outletCount: number;
  teams: TeamNews[];
  upcomingGames: { date: string | null; games: UpcomingGame[] };
}
