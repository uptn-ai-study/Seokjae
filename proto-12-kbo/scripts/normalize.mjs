/**
 * 원본(소스 레코드) → 정규화 스키마 변환 + 팀 순위 산출.
 * data/schema/*.json 과 짝을 이룬다.
 */

/** KBO 팀 ID ↔ 표기 (2026 시즌 1군 10개 구단) */
export const TEAMS = {
  LG: { name: 'LG', fullName: 'LG 트윈스' },
  OB: { name: '두산', fullName: '두산 베어스' },
  SK: { name: 'SSG', fullName: 'SSG 랜더스' },
  WO: { name: '키움', fullName: '키움 히어로즈' },
  SS: { name: '삼성', fullName: '삼성 라이온즈' },
  HT: { name: 'KIA', fullName: 'KIA 타이거즈' },
  LT: { name: '롯데', fullName: '롯데 자이언츠' },
  NC: { name: 'NC', fullName: 'NC 다이노스' },
  KT: { name: 'KT', fullName: 'KT 위즈' },
  HH: { name: '한화', fullName: '한화 이글스' },
};

const TEAM_NAME_TO_ID = Object.fromEntries(
  Object.entries(TEAMS).map(([id, t]) => [t.name, id]),
);

export function teamIdFromName(name) {
  return TEAM_NAME_TO_ID[name] ?? null;
}

// ------------------------------------------------------------------ 경기

export function normalizeGames(sourceGames, { season, sourceName, boxscoreIds = new Set() }) {
  const games = sourceGames
    .filter((g) => g.season === season)
    .map((g) => ({
      gameId: g.gameId,
      date: g.date,
      time: g.time,
      season: g.season,
      seriesId: g.seriesId,
      seriesName: g.seriesName,
      stadium: g.stadium,
      status: g.status,
      cancelReason: g.cancelReason ?? '',
      away: { teamId: g.awayTeamId, teamName: g.awayTeamName, score: g.awayScore },
      home: { teamId: g.homeTeamId, teamName: g.homeTeamName, score: g.homeScore },
      winPitcher: g.winPitcher,
      losePitcher: g.losePitcher,
      savePitcher: g.savePitcher,
      hasBoxscore: boxscoreIds.has(g.gameId),
    }))
    .sort((a, b) => a.gameId.localeCompare(b.gameId));
  // 증분 upsert 대비: gameId 기준 중복 제거(뒤에 온 레코드가 최신)
  const byId = new Map(games.map((g) => [g.gameId, g]));
  return {
    season,
    source: sourceName,
    generatedAt: new Date().toISOString(),
    games: [...byId.values()],
  };
}

// ------------------------------------------------------------------ 순위

/** 정규시즌(seriesId=0) 완료 경기에서 순위표 산출 */
export function computeStandings(normalizedGames, { season }) {
  const finished = normalizedGames.games.filter(
    (g) => g.seriesId === 0 && g.status === 'finished' && g.away.score != null && g.home.score != null,
  );
  const table = new Map();
  const ensure = (teamId, teamName) => {
    if (!table.has(teamId)) {
      table.set(teamId, {
        teamId,
        teamName,
        games: 0, wins: 0, losses: 0, ties: 0,
        runsScored: 0, runsAllowed: 0,
        results: [], // 시간순 'W'|'L'|'T'
      });
    }
    return table.get(teamId);
  };
  for (const g of finished) {
    const away = ensure(g.away.teamId, g.away.teamName);
    const home = ensure(g.home.teamId, g.home.teamName);
    away.games++; home.games++;
    away.runsScored += g.away.score; away.runsAllowed += g.home.score;
    home.runsScored += g.home.score; home.runsAllowed += g.away.score;
    if (g.away.score > g.home.score) {
      away.wins++; home.losses++;
      away.results.push('W'); home.results.push('L');
    } else if (g.away.score < g.home.score) {
      home.wins++; away.losses++;
      home.results.push('W'); away.results.push('L');
    } else {
      away.ties++; home.ties++;
      away.results.push('T'); home.results.push('T');
    }
  }
  const rows = [...table.values()].map((t) => {
    const decided = t.wins + t.losses;
    const winPct = decided > 0 ? t.wins / decided : 0;
    const last10 = t.results.slice(-10);
    const streak = computeStreak(t.results);
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      games: t.games,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      winPct: Number(winPct.toFixed(3)),
      gamesBehind: 0,
      last10: {
        wins: last10.filter((r) => r === 'W').length,
        losses: last10.filter((r) => r === 'L').length,
        ties: last10.filter((r) => r === 'T').length,
      },
      streak,
      runsScored: t.runsScored,
      runsAllowed: t.runsAllowed,
    };
  });
  rows.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
  const top = rows[0];
  for (const [i, r] of rows.entries()) {
    r.rank = i + 1;
    r.gamesBehind = top
      ? Number((((top.wins - r.wins) + (r.losses - top.losses)) / 2).toFixed(1))
      : 0;
  }
  return {
    season,
    generatedAt: new Date().toISOString(),
    basedOnGames: finished.length,
    standings: rows,
  };
}

function computeStreak(results) {
  if (!results.length) return '';
  const last = results[results.length - 1];
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  const label = { W: '승', L: '패', T: '무' }[last];
  return `${n}${label}`;
}

// ------------------------------------------------------------- 선수 기록

const num = (v) => {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** "45 1/3" 같은 이닝 표기 → 소수 이닝 */
const innings = (v) => {
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(\d+)?\s*(?:(\d)\/3)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) + (m[2] ? Number(m[2]) / 3 : 0);
};

const HITTER_MAP = {
  HRA_RT: ['avg', num], GAME_CN: ['g', num], PA_CN: ['pa', num], AB_CN: ['ab', num],
  RUN_CN: ['r', num], HIT_CN: ['h', num], H2_CN: ['h2', num], H3_CN: ['h3', num],
  HR_CN: ['hr', num], TB_CN: ['tb', num], RBI_CN: ['rbi', num], SH_CN: ['sh', num],
  SF_CN: ['sf', num], BB_CN: ['bb', num], IB_CN: ['ibb', num], HP_CN: ['hbp', num],
  KK_CN: ['so', num], GD_CN: ['gdp', num], SLG_RT: ['slg', num], OBP_RT: ['obp', num],
  OPS_RT: ['ops', num], MH_HITTER_CN: ['multiHit', num], SP_HRA_RT: ['rispAvg', num],
  PH_HRA_RT: ['phAvg', num],
};

const PITCHER_MAP = {
  ERA_RT: ['era', num], GAME_CN: ['g', num], W_CN: ['w', num], L_CN: ['l', num],
  SV_CN: ['sv', num], HOLD_CN: ['hld', num], WRA_RT: ['winPct', num],
  INN2_CN: ['ip', innings], HIT_CN: ['h', num], HR_CN: ['hr', num], BB_CN: ['bb', num],
  HP_CN: ['hbp', num], KK_CN: ['so', num], R_CN: ['r', num], ER_CN: ['er', num],
  WHIP_RT: ['whip', num], CG_CN: ['cg', num], SHO_CN: ['sho', num], QS_CN: ['qs', num],
  BS_CN: ['bs', num], PA_CN: ['bf', num], PIT_CN: ['pitches', num], OAVG_RT: ['oavg', num],
  H2_CN: ['h2', num], H3_CN: ['h3', num], SH_CN: ['sh', num], SF_CN: ['sf', num],
  IB_CN: ['ibb', num], WP_CN: ['wp', num], BK_CN: ['bk', num],
};

function normalizePlayer(raw, map) {
  const rec = {
    playerId: raw.playerId,
    name: raw.name,
    teamName: raw.teamName,
    teamId: teamIdFromName(raw.teamName),
  };
  for (const [key, [field, cast]] of Object.entries(map)) {
    if (key in raw) rec[field] = cast(raw[key]);
  }
  return rec;
}

export function normalizeHitters(rawHitters, { season, sourceName }) {
  return {
    season,
    source: sourceName,
    generatedAt: new Date().toISOString(),
    qualifiedOnly: true, // 기록실 기본 필터(규정타석) 기준
    hitters: rawHitters.map((r) => normalizePlayer(r, HITTER_MAP)),
  };
}

export function normalizePitchers(rawPitchers, { season, sourceName }) {
  return {
    season,
    source: sourceName,
    generatedAt: new Date().toISOString(),
    qualifiedOnly: true, // 기록실 기본 필터(규정이닝) 기준
    pitchers: rawPitchers.map((r) => normalizePlayer(r, PITCHER_MAP)),
  };
}
