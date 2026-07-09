/**
 * 수집 파이프라인 공통 로직: 원본 수집(raw 캐시) → 정규화 → 서빙 JSON.
 * build_dataset.mjs(전량)와 update_incremental.mjs(증분)가 공유한다.
 *
 * 증분 upsert 전략:
 *  - 날짜별 경기 목록은 data/raw/games/*.json 에 캐시된다.
 *    지난 날짜는 캐시를 그대로 쓰고, 최근 forceDays 일만 다시 요청한다.
 *  - 박스스코어는 gameId 별 캐시. 이미 수집된 경기는 재요청하지 않는다.
 *  - 따라서 어떤 모드로 실행해도 기존 데이터는 보존되고 최신분만 갱신된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './lib/http.mjs';
import { getSource } from './sources/base.mjs';
import './sources/kbo_official.mjs';
import './sources/csv_archive.mjs';
import {
  normalizeGames,
  computeStandings,
  normalizeHitters,
  normalizePitchers,
} from './normalize.mjs';

const ROOT = projectRoot();
const NORMALIZED = path.join(ROOT, 'data', 'normalized');
const PUBLIC_DATA = path.join(ROOT, 'public', 'data');

function writeJson(dir, relPath, obj) {
  const file = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1), 'utf8');
}

/** 정규화 결과를 data/normalized 와 public/data 두 곳에 동일하게 기록 */
function publish(relPath, obj) {
  writeJson(NORMALIZED, relPath, obj);
  writeJson(PUBLIC_DATA, relPath, obj);
}

export async function runPipeline({
  season = 2026,
  sourceName = 'kbo_official',
  from,
  forceDays = 2,
  boxscoreDays = 14,
  skipPlayers = false,
} = {}) {
  const source = getSource(sourceName);
  console.log(`[1/4] 경기 목록 수집 (source=${sourceName}, season=${season})`);
  const sourceGames = await source.fetchGames({ season, from, forceDays });
  console.log(`  총 ${sourceGames.length} 경기`);

  console.log(`[2/4] 박스스코어 수집 (최근 ${boxscoreDays}일 + 캐시분)`);
  const boxscoreIds = new Set(existingBoxscoreIds());
  if (source.fetchGameDetail) {
    const cutoff = ymdDaysAgo(boxscoreDays);
    const targets = sourceGames.filter(
      (g) => g.status === 'finished' && (g.date >= cutoff || !boxscoreIds.has(g.gameId)),
    );
    // 최근 경기 우선. 컷오프 이전의 미수집 경기는 건드리지 않음(요청량 제한).
    const recent = targets.filter((g) => g.date >= cutoff);
    for (const g of recent) {
      try {
        const detail = await source.fetchGameDetail(g, { forceRefresh: g.date >= ymdDaysAgo(1) });
        publish(`boxscores/${g.gameId}.json`, detail);
        boxscoreIds.add(g.gameId);
        console.log(`  boxscore ${g.gameId} ok`);
      } catch (err) {
        console.warn(`  boxscore ${g.gameId} FAILED - ${err.message}`);
      }
    }
    // 캐시에 이미 있는 박스스코어도 public 에 반영
    for (const id of boxscoreIds) {
      const cached = readRawBoxscore(id);
      if (cached) publish(`boxscores/${id}.json`, cached);
    }
  }

  console.log('[3/4] 정규화 및 순위 산출');
  const games = normalizeGames(sourceGames, { season, sourceName, boxscoreIds });
  const standings = computeStandings(games, { season });
  publish(`games/${season}.json`, games);
  publish(`standings/${season}.json`, standings);
  console.log(`  games=${games.games.length}, standings=${standings.standings.length}팀 (${standings.basedOnGames}경기 기준)`);

  if (!skipPlayers) {
    console.log('[4/4] 선수 기록 수집(타자/투수)');
    const { hitters, pitchers } = await source.fetchPlayers({ season });
    publish(`hitters/${season}.json`, normalizeHitters(hitters, { season, sourceName }));
    publish(`pitchers/${season}.json`, normalizePitchers(pitchers, { season, sourceName }));
    console.log(`  hitters=${hitters.length}, pitchers=${pitchers.length}`);
  } else {
    console.log('[4/4] 선수 기록 수집 생략(--skip-players)');
  }

  publish('manifest.json', {
    season,
    source: sourceName,
    generatedAt: new Date().toISOString(),
    datasets: ['games', 'standings', 'hitters', 'pitchers'],
  });
  console.log('완료: data/normalized/* 및 public/data/* 갱신됨');
}

function ymdDaysAgo(days) {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');
}

function existingBoxscoreIds() {
  const dir = path.join(ROOT, 'data', 'raw', 'boxscore');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

function readRawBoxscore(gameId) {
  const file = path.join(ROOT, 'data', 'raw', 'boxscore', `${gameId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--season') opts.season = Number(argv[++i]);
    else if (a === '--source') opts.sourceName = argv[++i];
    else if (a === '--from') opts.from = argv[++i];
    else if (a === '--force-days') opts.forceDays = Number(argv[++i]);
    else if (a === '--boxscore-days') opts.boxscoreDays = Number(argv[++i]);
    else if (a === '--skip-players') opts.skipPlayers = true;
  }
  return opts;
}
