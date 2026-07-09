/**
 * KBO 공식 홈페이지(koreabaseball.com) 크롤러 어댑터.
 *
 * ⚠ 데이터 저작권은 KBO(한국야구위원회)에 있으며, 본 코드는
 *   비상업적/학습용으로만 사용한다. robots.txt 를 준수하고
 *   요청 간 지연을 둔다 (scripts/lib/http.mjs 참고).
 *
 * 사용 엔드포인트 (2026-07 기준 실측 검증):
 *  - POST /ws/Main.asmx/GetKboGameList        날짜별 경기 목록+결과 (JSON)
 *  - POST /ws/Schedule.asmx/GetScoreBoardScroll  경기별 이닝 라인스코어 (JSON)
 *  - POST /ws/Schedule.asmx/GetBoxScoreScroll    경기별 박스스코어 (JSON)
 *  - GET/POST /Record/Player/{Hitter,Pitcher}Basic/Basic{1,2}.aspx
 *      기록실 페이지 (ASP.NET __VIEWSTATE 페이지네이션, HTML 테이블)
 */
import * as cheerio from 'cheerio';
import { postForm, getPage, saveRaw, readRaw } from '../lib/http.mjs';
import { registerSource } from './base.mjs';

const BASE = 'https://www.koreabaseball.com';
const SR_ID_LIST = '0,1,3,4,5,7,9'; // 1군 전체 시리즈 (정규/시범/포스트 등)

// ---------------------------------------------------------------- 경기 목록

/** YYYYMMDD 문자열 유틸 */
function ymd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function* dateRange(from, to) {
  const d = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T00:00:00Z`);
  const end = new Date(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T00:00:00Z`);
  while (d <= end) {
    yield ymd(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

/** 날짜 하나의 경기 목록 (raw 캐시: 지나간 날짜는 재요청하지 않음) */
async function fetchGameListForDate(date, { todayYmd, forceRefresh = false }) {
  const cachePath = `games/${date}.json`;
  const isImmutable = date < todayYmd; // 지난 날짜의 결과는 변하지 않음
  if (!forceRefresh && isImmutable) {
    const cached = readRaw(cachePath);
    if (cached) return JSON.parse(cached);
  }
  const text = await postForm(
    `${BASE}/ws/Main.asmx/GetKboGameList`,
    { leId: '1', srId: SR_ID_LIST, date },
    { referer: `${BASE}/Schedule/ScoreBoard.aspx` },
  );
  const json = JSON.parse(text);
  saveRaw(cachePath, text);
  return json;
}

const GAME_STATE = { 1: 'scheduled', 2: 'live', 3: 'finished', 4: 'canceled', 5: 'suspended' };

function toSourceGame(g) {
  return {
    gameId: g.G_ID,
    date: g.G_DT,
    time: g.G_TM ?? '',
    season: g.SEASON_ID,
    seriesId: g.SR_ID,
    seriesName: g.GAME_SC_NM ?? '',
    stadium: g.S_NM ?? '',
    status: GAME_STATE[String(g.GAME_STATE_SC)] ?? 'scheduled',
    cancelReason: g.CANCEL_SC_ID !== '0' ? (g.CANCEL_SC_NM ?? '') : '',
    awayTeamId: g.AWAY_ID,
    homeTeamId: g.HOME_ID,
    awayTeamName: g.AWAY_NM,
    homeTeamName: g.HOME_NM,
    awayScore: g.T_SCORE_CN === '' || g.T_SCORE_CN == null ? null : Number(g.T_SCORE_CN),
    homeScore: g.B_SCORE_CN === '' || g.B_SCORE_CN == null ? null : Number(g.B_SCORE_CN),
    winPitcher: (g.W_PIT_P_NM ?? '').trim() || null,
    losePitcher: (g.L_PIT_P_NM ?? '').trim() || null,
    savePitcher: (g.SV_PIT_P_NM ?? '').trim() || null,
    broadcast: g.TV_IF ?? '',
  };
}

async function fetchGames({ from, to, forceDays = 2 } = {}) {
  const todayYmd = ymd(new Date());
  const games = [];
  const forceFrom = ymd(new Date(Date.now() - forceDays * 86400_000));
  for (const date of dateRange(from, to)) {
    if (date > todayYmd) break;
    try {
      const json = await fetchGameListForDate(date, {
        todayYmd,
        forceRefresh: date >= forceFrom,
      });
      const list = Array.isArray(json.game) ? json.game : [];
      for (const g of list) games.push(toSourceGame(g));
      if (list.length) console.log(`  ${date}: ${list.length} games`);
    } catch (err) {
      console.warn(`  ${date}: FAILED - ${err.message}`);
    }
  }
  return games;
}

// ------------------------------------------------------------- 박스스코어

/** KBO 내부 table JSON({headers, rows} of cells) → 문자열 매트릭스 */
function tableToMatrix(tableJsonStr) {
  if (!tableJsonStr) return { headers: [], rows: [] };
  const t = typeof tableJsonStr === 'string' ? JSON.parse(tableJsonStr) : tableJsonStr;
  const cellText = (c) =>
    String(c.Text ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  const toRows = (arr) => (arr ?? []).map((r) => (r.row ?? []).map(cellText));
  return { headers: toRows(t.headers), rows: toRows(t.rows) };
}

async function fetchGameDetail(game, { forceRefresh = false } = {}) {
  const { gameId, date, seriesId, season } = game;
  const cachePath = `boxscore/${gameId}.json`;
  if (!forceRefresh) {
    const cached = readRaw(cachePath);
    if (cached) return JSON.parse(cached);
  }
  const params = {
    leId: '1',
    srId: String(seriesId),
    seasonId: String(season),
    gameDate: date,
    gameId,
  };
  const [sbText, bxText] = [
    await postForm(`${BASE}/ws/Schedule.asmx/GetScoreBoardScroll`, params, {
      referer: `${BASE}/Schedule/ScoreBoard.aspx`,
    }),
    await postForm(`${BASE}/ws/Schedule.asmx/GetBoxScoreScroll`, params, {
      referer: `${BASE}/Schedule/BoxScore.aspx`,
    }),
  ];
  const sb = JSON.parse(sbText);
  const bx = JSON.parse(bxText);

  const detail = {
    gameId,
    meta: {
      stadium: sb.S_NM ?? '',
      crowd: sb.CROWD_CN ?? '',
      startTime: sb.START_TM ?? '',
      endTime: sb.END_TM ?? '',
      duration: sb.USE_TM ?? '',
      awayFullName: sb.FULL_AWAY_NM ?? '',
      homeFullName: sb.FULL_HOME_NM ?? '',
    },
    lineScore: {
      innings: tableToMatrix(sb.table2),
      totals: tableToMatrix(sb.table3),
      result: tableToMatrix(sb.table1),
    },
    hitters: (bx.arrHitter ?? []).map((h) => ({
      lineup: tableToMatrix(h.table1),
      byInning: tableToMatrix(h.table2),
      totals: tableToMatrix(h.table3),
    })),
    pitchers: (bx.arrPitcher ?? []).map((p) => tableToMatrix(p.table)),
    etc: tableToMatrix(bx.tableEtc),
  };
  saveRaw(cachePath, JSON.stringify(detail));
  return detail;
}

// ------------------------------------------------------- 기록실 (타자/투수)

const RECORD_PAGES = {
  hitters: ['/Record/Player/HitterBasic/Basic1.aspx', '/Record/Player/HitterBasic/Basic2.aspx'],
  pitchers: ['/Record/Player/PitcherBasic/Basic1.aspx', '/Record/Player/PitcherBasic/Basic2.aspx'],
};

/** 기록 테이블 한 페이지 파싱: data-id 컬럼 키 + 선수/팀 → 레코드 배열 */
function parseRecordTable(html) {
  const $ = cheerio.load(html);
  const records = [];
  $('table.tData01 tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return;
    const link = $(tds[1]).find('a');
    const playerId = (link.attr('href') ?? '').match(/playerId=(\d+)/)?.[1] ?? null;
    const rec = {
      playerId,
      name: link.text().trim() || $(tds[1]).text().trim(),
      teamName: $(tds[2]).text().trim(),
    };
    tds.each((__, td) => {
      const key = $(td).attr('data-id');
      if (key) rec[key] = $(td).text().trim();
    });
    if (rec.name) records.push(rec);
  });
  return records;
}

/** ASP.NET 폼 상태(hidden + select 현재값) 수집 */
function collectFormState(html) {
  const $ = cheerio.load(html);
  const state = {};
  $('input[type=hidden]').each((_, el) => {
    state[$(el).attr('name')] = $(el).attr('value') ?? '';
  });
  $('select').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    const selected = $(el).find('option[selected]').attr('value') ?? $(el).find('option').first().attr('value') ?? '';
    state[name] = selected;
  });
  return state;
}

function hasPageButton(html, pageNo) {
  return html.includes(`ucPager$btnNo${pageNo}`);
}

/** __VIEWSTATE 포스트백으로 전 페이지 순회 수집 */
async function fetchRecordPage(pagePath, { maxPages = 20 } = {}) {
  const url = `${BASE}${pagePath}`;
  let html = await getPage(url);
  let all = parseRecordTable(html);
  for (let page = 2; page <= maxPages; page++) {
    if (!hasPageButton(html, page)) break;
    const form = collectFormState(html);
    form['__EVENTTARGET'] = `ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$ucPager$btnNo${page}`;
    form['__EVENTARGUMENT'] = '';
    html = await postForm(url, form, { referer: url });
    const rows = parseRecordTable(html);
    if (!rows.length) break;
    all = all.concat(rows);
  }
  return all;
}

/** Basic1 + Basic2 를 playerId 기준으로 병합 */
async function fetchPlayerGroup(kind) {
  const [page1, page2] = RECORD_PAGES[kind];
  console.log(`  fetching ${kind} basic1...`);
  const base = await fetchRecordPage(page1);
  console.log(`  fetching ${kind} basic2...`);
  const extra = await fetchRecordPage(page2);
  const byId = new Map(base.map((r) => [r.playerId ?? r.name, r]));
  for (const r of extra) {
    const key = r.playerId ?? r.name;
    const target = byId.get(key);
    if (target) Object.assign(target, r);
    else byId.set(key, r);
  }
  return [...byId.values()];
}

async function fetchPlayers({ season }) {
  const hitters = await fetchPlayerGroup('hitters');
  const pitchers = await fetchPlayerGroup('pitchers');
  saveRaw(`players/hitters-${season}.json`, JSON.stringify(hitters));
  saveRaw(`players/pitchers-${season}.json`, JSON.stringify(pitchers));
  return { hitters, pitchers };
}

// ----------------------------------------------------------------- 등록

export const kboOfficial = {
  name: 'kbo_official',
  fetchGames: ({ season, from, to, forceDays }) =>
    fetchGames({
      from: from ?? `${season}0301`,
      to: to ?? ymd(new Date()),
      forceDays,
    }),
  fetchPlayers,
  fetchGameDetail,
};

registerSource(kboOfficial);
