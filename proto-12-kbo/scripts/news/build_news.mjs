/**
 * 뉴스 심리 데이터셋 빌드.
 *
 * 기준 시각: 게임 데이터의 최신 경기일(as-of)을 기준으로 최근 windowDays(기본 3)일.
 *  → "데이터 업데이트 시각 기준 최근 사흘"을 실시간(now)이 아닌 데이터 시점에 앵커링.
 *
 * 감성 분석은 교체식 provider(scripts/news/providers.mjs):
 *  - NVIDIA_API_KEY 있음 → Qwen 3.5 로 기사별 팀 맥락 감성(여러 팀 기사도 팀별로 판정)
 *  - 없음/실패 → 사전(키워드) 기반, 단일 팀 기사만 집계
 *
 * 산출: data/normalized/news/<season>.json
 */
import { projectRoot } from '../lib/http.mjs';
import { TEAMS } from '../normalize.mjs';
import { fetchTeamNews, addDays } from './google_news.mjs';
import { matchOutlet, outletsByCategory, OUTLETS } from './outlets.mjs';
import { topKeywords } from './sentiment.mjs';
import { detectTeams } from './teams_detect.mjs';
import { getSentimentProvider, lexiconProvider } from './providers.mjs';
import fs from 'node:fs';
import path from 'node:path';

const MAX_ARTICLES_PER_TEAM = 8; // 화면 표시용 대표 기사 수

/** 팀 검색어: 정식 명칭 + '야구'로 노이즈 축소 */
function queryFor(teamId) {
  return `${TEAMS[teamId].fullName} 야구`;
}

function iso(pubDate) {
  const t = Date.parse(pubDate);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** 전 팀 검색 결과를 모아 제목 기준 전역 중복 제거 + 팀 감지 */
async function collectArticles(window) {
  const byKey = new Map();
  for (const teamId of Object.keys(TEAMS)) {
    const raw = await fetchTeamNews(queryFor(teamId), window);
    for (const it of raw) {
      const outlet = matchOutlet(it.source);
      if (!outlet) continue; // 주요 언론사만
      const key = it.title.replace(/\s+/g, '');
      if (!key) continue;
      if (!byKey.has(key)) {
        const text = `${it.title} ${it.description}`;
        byKey.set(key, {
          title: it.title,
          description: it.description ?? '',
          text,
          outlet,
          url: it.link,
          publishedAt: iso(it.pubDate),
          teams: detectTeams(text),
        });
      }
      // 검색한 팀은 반드시 후보에 포함(감지 누락 방지)
      byKey.get(key).teams.add(teamId);
    }
  }
  return [...byKey.values()];
}

/** 한 팀의 집계 결과 생성 */
function aggregateTeam(teamId, articles) {
  const mine = articles.filter((a) => a.teams.has(teamId));
  const entries = mine.map((a) => {
    const pt = a.perTeam?.[teamId];
    return pt
      ? { a, label: pt.label, score: pt.score, reason: pt.reason || '', terms: pt.terms, counted: true }
      : { a, label: 'neu', score: 0, reason: '', terms: null, counted: false };
  });

  const counted = entries.filter((e) => e.counted);
  const positiveScore = counted.reduce((s, e) => s + Math.max(0, e.score), 0);
  const negativeScore = counted.reduce((s, e) => s + Math.max(0, -e.score), 0);
  const posArticles = counted.filter((e) => e.label === 'pos').length;
  const negArticles = counted.filter((e) => e.label === 'neg').length;
  const neuArticles = counted.filter((e) => e.label === 'neu').length;
  const topPos = topKeywords(counted.map((e) => e.terms?.pos ?? []));
  const topNeg = topKeywords(counted.map((e) => e.terms?.neg ?? []));

  const singleTeamArticles = mine.filter((a) => a.teams.size === 1).length;
  const multiTeamArticles = mine.filter((a) => a.teams.size > 1).length;

  // 표시: 집계된 기사(신호)를 |점수|·최신 순 우선, 미집계(참고)는 뒤로
  const display = [...entries]
    .sort((x, y) => {
      const sx = x.counted ? Math.abs(x.score) : -1;
      const sy = y.counted ? Math.abs(y.score) : -1;
      return sy - sx || (y.a.publishedAt || '').localeCompare(x.a.publishedAt || '');
    })
    .slice(0, MAX_ARTICLES_PER_TEAM)
    .map((e) => ({
      title: e.a.title,
      outlet: e.a.outlet,
      url: e.a.url,
      publishedAt: e.a.publishedAt,
      label: e.label,
      score: e.score,
      reason: e.reason,
      multiTeam: !e.counted, // 미집계(참고)만 '여러 팀' 취급
    }));

  return {
    teamId,
    teamName: TEAMS[teamId].name,
    articleCount: mine.length,
    countedArticles: counted.length,
    singleTeamArticles,
    multiTeamArticles,
    posArticles,
    negArticles,
    neuArticles,
    positiveScore,
    negativeScore,
    netScore: positiveScore - negativeScore,
    topPositiveKeywords: topPos,
    topNegativeKeywords: topNeg,
    summary: '',
    articles: display,
  };
}

function summarize(t, isLLM) {
  if (t.countedArticles === 0) {
    return t.articleCount > 0
      ? '집계 대상 기사가 없습니다(참고 기사만 존재).'
      : '최근 3일간 주요 언론 기사가 없습니다.';
  }
  if (isLLM) {
    return `주요 언론 기사 ${t.articleCount}건 중 ${t.countedArticles}건 팀 맥락 분석 (긍정 ${t.posArticles} · 부정 ${t.negArticles}).`;
  }
  const parts = [`단일 팀 기사 ${t.countedArticles}건 기준 (긍정 ${t.posArticles} · 부정 ${t.negArticles})`];
  if (t.multiTeamArticles > 0) parts.push(`여러 팀 언급 ${t.multiTeamArticles}건은 중립(참고)`);
  if (t.topPositiveKeywords.length) parts.push(`긍정 키워드: ${t.topPositiveKeywords.join(', ')}`);
  if (t.topNegativeKeywords.length) parts.push(`부정 키워드: ${t.topNegativeKeywords.join(', ')}`);
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

const LEXICON_DISCLAIMER =
  '단일 팀만 언급된 기사만 사전(키워드) 감성으로 집계하고, 여러 팀이 함께 언급된 기사는 어느 팀의 호재/악재인지 판별할 수 없어 중립(참고)으로 제외합니다. 문맥·반어는 반영하지 못하는 실험적 지표이며 실제 경기 결과 예측이 아닙니다.';

function llmDisclaimer(label) {
  return `AI(${label})가 기사별로 각 구단 관점의 호재/악재를 판정합니다. 여러 팀이 함께 나온 경기 기사도 팀마다 다르게 집계합니다. 자동 분석이므로 오차가 있을 수 있는 참고용 지표이며 실제 승부 예측이 아닙니다.`;
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

  const articles = await collectArticles(window);
  console.log(`  주요 언론 고유 기사 ${articles.length}건`);

  // 감성 분석 (실패 시 사전 방식으로 폴백)
  let provider = getSentimentProvider();
  let method;
  console.log(`  감성 provider: ${provider.name}`);
  try {
    method = await provider.classify(articles);
  } catch (err) {
    console.warn(`  ${provider.name} 실패 → 사전 방식 폴백: ${err.message}`);
    provider = lexiconProvider();
    method = await provider.classify(articles);
  }
  const isLLM = method.startsWith('nvidia');
  const modelLabel = isLLM ? provider.modelLabel : null;

  const teams = Object.keys(TEAMS).map((teamId) => {
    const t = aggregateTeam(teamId, articles);
    t.summary = summarize(t, isLLM);
    console.log(`  ${t.teamName}: 기사 ${t.articleCount} (긍정 ${t.posArticles}/부정 ${t.negArticles}, net ${t.netScore})`);
    return t;
  });

  const upcoming = await fetchUpcoming(asOf, season);
  if (upcoming.date) console.log(`  다음 경기(${upcoming.date}): ${upcoming.games.length}경기`);

  return {
    season,
    generatedAt: new Date().toISOString(),
    asOf,
    window,
    method,
    modelLabel,
    disclaimer: isLLM ? llmDisclaimer(modelLabel) : LEXICON_DISCLAIMER,
    outlets: outletsByCategory(),
    outletCount: OUTLETS.length,
    teams,
    upcomingGames: upcoming,
  };
}
