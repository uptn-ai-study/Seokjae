/**
 * 뉴스 심리 데이터셋 빌드.
 *
 * 기준 시각: 게임 데이터의 최신 경기일(as-of)을 기준으로 최근 windowDays(기본 3)일.
 *  → "데이터 업데이트 시각 기준 최근 사흘"을 실시간(now)이 아닌 데이터 시점에 앵커링.
 *
 * 산출: data/normalized/news/<season>.json
 *  - window: {days, from, to}  (YYYYMMDD)
 *  - outlets: 참고 언론사 목록(카테고리별)
 *  - teams[]: 팀별 긍정/부정 점수, 대표 기사, 템플릿 요약
 *  - upcomingGames[]: as-of 다음 경기일의 매치업(다음 경기 예측용)
 *
 * 순위/예측은 프론트에서 news + standings 로 계산한다(데이터층은 사실만 담는다).
 */
import { projectRoot } from '../lib/http.mjs';
import { TEAMS } from '../normalize.mjs';
import { fetchTeamNews, addDays } from './google_news.mjs';
import { matchOutlet, outletsByCategory, OUTLETS } from './outlets.mjs';
import { scoreText, topKeywords } from './sentiment.mjs';
import fs from 'node:fs';
import path from 'node:path';

const MAX_ARTICLES_PER_TEAM = 8; // 화면 표시용 대표 기사 수

/** 팀 검색어: 정식 명칭 + '야구'로 노이즈 축소 */
function queryFor(teamId) {
  return `${TEAMS[teamId].fullName} 야구`;
}

/**
 * 팀 언급 감지용 별칭. 여러 팀이 함께 언급된 기사는 사전만으로 어느 팀의 호재/악재인지
 * 판별할 수 없으므로 중립(참고)으로 분류하고 점수 집계에서 제외한다.
 * 감지가 과도하면 중립으로 빠질 뿐(안전한 방향)이라, 별칭은 넉넉히 둔다.
 */
const TEAM_ALIASES = {
  LG: ['LG', '엘지', '트윈스'],
  OB: ['두산', '베어스'],
  SK: ['SSG', '랜더스', '에스에스지'],
  WO: ['키움', '히어로즈'],
  SS: ['삼성', '라이온즈'],
  HT: ['KIA', '기아', '타이거즈'],
  LT: ['롯데', '자이언츠'],
  NC: ['NC', '엔씨', '다이노스'],
  KT: ['KT', '케이티', '위즈'],
  HH: ['한화', '이글스'],
};

/** 텍스트에 등장하는 KBO 팀 id 집합 */
function detectTeams(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const [teamId, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some((a) => lower.includes(a.toLowerCase()))) found.add(teamId);
  }
  return found;
}

function iso(pubDate) {
  const t = Date.parse(pubDate);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

async function buildTeam(teamId, window) {
  const raw = await fetchTeamNews(queryFor(teamId), window);
  const articles = [];
  for (const it of raw) {
    const outlet = matchOutlet(it.source);
    if (!outlet) continue; // 주요 언론사만
    const text = `${it.title} ${it.description}`;
    const teams = detectTeams(text);
    const multiTeam = teams.size >= 2; // 여러 팀 언급 → 중립(참고), 점수 제외
    const s = scoreText(text);
    articles.push({
      title: it.title,
      outlet,
      url: it.link,
      publishedAt: iso(it.pubDate),
      multiTeam,
      score: multiTeam ? 0 : s.score,
      label: multiTeam ? 'neu' : s.label,
      posTerms: multiTeam ? [] : s.posTerms,
      negTerms: multiTeam ? [] : s.negTerms,
    });
  }
  // 중복 제목 제거(같은 기사 복수 송고)
  const seen = new Set();
  const deduped = articles.filter((a) => {
    const key = a.title.replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 감성 집계는 단일 팀 기사만 사용
  const scored = deduped.filter((a) => !a.multiTeam);
  const multiTeamArticles = deduped.length - scored.length;
  const positiveScore = scored.reduce((s, a) => s + Math.max(0, a.score), 0);
  const negativeScore = scored.reduce((s, a) => s + Math.max(0, -a.score), 0);
  const posArticles = scored.filter((a) => a.label === 'pos').length;
  const negArticles = scored.filter((a) => a.label === 'neg').length;
  const neuArticles = scored.filter((a) => a.label === 'neu').length;
  const topPos = topKeywords(scored.map((a) => a.posTerms));
  const topNeg = topKeywords(scored.map((a) => a.negTerms));

  // 표시: 단일 팀 기사(신호)를 |점수|·최신 순 우선, 여러 팀 기사(참고)는 뒤로
  const display = [...deduped]
    .sort((a, b) => {
      const sa = a.multiTeam ? -1 : Math.abs(a.score);
      const sb = b.multiTeam ? -1 : Math.abs(b.score);
      return sb - sa || (b.publishedAt || '').localeCompare(a.publishedAt || '');
    })
    .slice(0, MAX_ARTICLES_PER_TEAM)
    .map(({ posTerms, negTerms, ...rest }) => rest);

  return {
    teamId,
    teamName: TEAMS[teamId].name,
    articleCount: deduped.length,
    singleTeamArticles: scored.length,
    multiTeamArticles,
    posArticles,
    negArticles,
    neuArticles,
    positiveScore,
    negativeScore,
    netScore: positiveScore - negativeScore,
    topPositiveKeywords: topPos,
    topNegativeKeywords: topNeg,
    summary: summarize({ scored: scored.length, multi: multiTeamArticles, posArticles, negArticles, topPos, topNeg }),
    articles: display,
  };
}

function summarize({ scored, multi, posArticles, negArticles, topPos, topNeg }) {
  if (scored === 0) {
    return multi > 0
      ? `단일 팀 기사가 없어 집계 대상이 없습니다(여러 팀 언급 ${multi}건은 참고).`
      : '최근 3일간 주요 언론 기사가 없습니다.';
  }
  const parts = [`단일 팀 기사 ${scored}건 기준 (긍정 ${posArticles} · 부정 ${negArticles})`];
  if (multi > 0) parts.push(`여러 팀 언급 ${multi}건은 중립(참고)`);
  if (topPos.length) parts.push(`긍정 키워드: ${topPos.join(', ')}`);
  if (topNeg.length) parts.push(`부정 키워드: ${topNeg.join(', ')}`);
  return parts.join('. ') + '.';
}

/** as-of 다음 경기일의 매치업 수집(KBO). 실패해도 예측 없이 진행. */
async function fetchUpcoming(asOf, season) {
  try {
    const { kboOfficial } = await import('../sources/kbo_official.mjs');
    for (let i = 1; i <= 3; i++) {
      const date = addDays(asOf, i);
      const games = await kboOfficial.fetchGames({ season, from: date, to: date, forceDays: 0 });
      const list = games.filter((g) => g.status !== 'canceled');
      if (list.length) {
        return {
          date,
          games: list.map((g) => ({
            gameId: g.gameId,
            awayTeamId: g.awayTeamId,
            homeTeamId: g.homeTeamId,
            awayTeamName: g.awayTeamName,
            homeTeamName: g.homeTeamName,
            status: g.status,
          })),
        };
      }
    }
  } catch (err) {
    console.warn('  다음 경기 일정 수집 실패:', err.message);
  }
  return { date: null, games: [] };
}

export async function buildNews({ season = 2026, windowDays = 3 } = {}) {
  const ROOT = projectRoot();
  const gamesFile = path.join(ROOT, 'data', 'normalized', 'games', `${season}.json`);
  if (!fs.existsSync(gamesFile)) {
    console.warn('news: games 데이터가 없어 뉴스 빌드를 건너뜁니다.');
    return null;
  }
  const games = JSON.parse(fs.readFileSync(gamesFile, 'utf8'));
  const dates = games.games.filter((g) => g.status === 'finished').map((g) => g.date).sort();
  const asOf = dates[dates.length - 1];
  if (!asOf) {
    console.warn('news: 완료 경기가 없어 뉴스 빌드를 건너뜁니다.');
    return null;
  }
  const window = { days: windowDays, from: addDays(asOf, -(windowDays - 1)), to: asOf };
  console.log(`뉴스 심리 수집: as-of ${asOf}, 창 ${window.from}~${window.to} (최근 ${windowDays}일)`);

  const teams = [];
  for (const teamId of Object.keys(TEAMS)) {
    const t = await buildTeam(teamId, window);
    teams.push(t);
    console.log(`  ${t.teamName}: 기사 ${t.articleCount} (긍정 ${t.posArticles}/부정 ${t.negArticles}, net ${t.netScore})`);
  }

  const upcoming = await fetchUpcoming(asOf, season);
  if (upcoming.date) console.log(`  다음 경기(${upcoming.date}): ${upcoming.games.length}경기`);

  return {
    season,
    generatedAt: new Date().toISOString(),
    asOf,
    window,
    method: 'lexicon-singleteam',
    disclaimer:
      '단일 팀만 언급된 기사만 사전(키워드) 감성으로 집계하고, 여러 팀이 함께 언급된 기사는 어느 팀의 호재/악재인지 판별할 수 없어 중립(참고)으로 제외합니다. 문맥·반어는 여전히 반영하지 못하는 실험적 지표이며 실제 경기 결과 예측이 아닙니다.',
    outlets: outletsByCategory(),
    outletCount: OUTLETS.length,
    teams,
    upcomingGames: upcoming,
  };
}
