/**
 * 뉴스 심리 데이터만 갱신하는 엔트리포인트.
 *   node scripts/update_news.mjs [--season 2026] [--window 3]
 *
 * data/normalized/news/<season>.json 및 public/data/news/<season>.json 생성.
 */
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './lib/http.mjs';
import { buildNews } from './news/build_news.mjs';

const args = process.argv.slice(2);
const season = Number(valueOf('--season') ?? 2026);
const windowDays = Number(valueOf('--window') ?? 3);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function writeBoth(relPath, obj) {
  const ROOT = projectRoot();
  for (const base of ['data/normalized', 'public/data']) {
    const file = path.join(ROOT, base, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 1), 'utf8');
  }
}

const data = await buildNews({ season, windowDays });
if (data) {
  writeBoth(`news/${season}.json`, data);
  console.log(`완료: news/${season}.json (${data.teams.length}팀)`);
} else {
  console.log('뉴스 데이터 생성 생략됨.');
  process.exit(0);
}
