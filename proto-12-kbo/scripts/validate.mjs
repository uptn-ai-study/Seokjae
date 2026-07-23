/**
 * 정규화 JSON 을 data/schema/*.schema.json 으로 검증한다.
 *   node scripts/validate.mjs [--season 2026]
 */
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { projectRoot } from './lib/http.mjs';

const ROOT = projectRoot();
const season = (() => {
  const i = process.argv.indexOf('--season');
  return i >= 0 ? process.argv[i + 1] : '2026';
})();

const ajv = new Ajv({ allErrors: true, strict: false });
const targets = [
  ['games.schema.json', `games/${season}.json`],
  ['standings.schema.json', `standings/${season}.json`],
  ['hitters.schema.json', `hitters/${season}.json`],
  ['pitchers.schema.json', `pitchers/${season}.json`],
  ['news.schema.json', `news/${season}.json`],
];

let failed = false;
for (const [schemaFile, dataFile] of targets) {
  const schemaPath = path.join(ROOT, 'data', 'schema', schemaFile);
  const dataPath = path.join(ROOT, 'data', 'normalized', dataFile);
  if (!fs.existsSync(dataPath)) {
    console.warn(`SKIP ${dataFile} (파일 없음)`);
    continue;
  }
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (validate(data)) {
    console.log(`OK   ${dataFile}`);
  } else {
    failed = true;
    console.error(`FAIL ${dataFile}`);
    for (const err of validate.errors.slice(0, 10)) {
      console.error(`  ${err.instancePath} ${err.message}`);
    }
  }
}

// 순위표 합계 검증: 승+패+무 == 경기수, 승패 총합 균형
const standingsPath = path.join(ROOT, 'data', 'normalized', `standings/${season}.json`);
if (fs.existsSync(standingsPath)) {
  const { standings } = JSON.parse(fs.readFileSync(standingsPath, 'utf8'));
  const bad = standings.filter((t) => t.wins + t.losses + t.ties !== t.games);
  const totalW = standings.reduce((s, t) => s + t.wins, 0);
  const totalL = standings.reduce((s, t) => s + t.losses, 0);
  if (bad.length || totalW !== totalL) {
    failed = true;
    console.error(`FAIL standings 합계 검증 (불일치 팀 ${bad.length}, 총승 ${totalW} vs 총패 ${totalL})`);
  } else {
    console.log(`OK   standings 합계 검증 (총 ${totalW}승 ${totalL}패)`);
  }
}

process.exit(failed ? 1 : 0);
