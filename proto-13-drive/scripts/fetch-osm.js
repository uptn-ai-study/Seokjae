#!/usr/bin/env node
/**
 * Overpass API → data/seoul-roads.geojson
 *
 *   node scripts/fetch-osm.js
 *
 * data/overpass-query.txt 의 쿼리를 그대로 POST 합니다.
 * 한 번 받아두면 이후 게임 구동에는 네트워크가 전혀 필요 없습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// 보존할 태그 (게임에서 사용)
const KEEP_TAGS = ['highway', 'name', 'name:en', 'oneway', 'lanes', 'maxspeed', 'junction', 'bridge', 'tunnel'];

function loadQuery() {
  const raw = fs.readFileSync(path.join(ROOT, 'data', 'overpass-query.txt'), 'utf8');
  // 앞쪽 주석(//) 줄 제거
  return raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
    .trim();
}

async function post(url, query) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // UA/Accept 가 없으면 Overpass가 406으로 거절하는 경우가 있다
      'User-Agent': 'proto-13-drive/1.0 (osm road extractor)',
      Accept: 'application/json',
    },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

function toGeoJSON(osm) {
  const features = [];
  for (const el of osm.elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const props = { id: el.id };
    for (const k of KEEP_TAGS) {
      if (el.tags && el.tags[k] != null) props[k] = el.tags[k];
    }
    // way를 구성하는 노드 id를 남겨두면 교차점 판정이 정확해진다
    props.nodes = el.nodes;
    features.push({
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'LineString',
        coordinates: el.geometry.map((p) => [+p.lon.toFixed(7), +p.lat.toFixed(7)]),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

const query = loadQuery();
let osm = null;
for (const ep of ENDPOINTS) {
  try {
    process.stdout.write(`[fetch] ${ep} ... `);
    osm = await post(ep, query);
    console.log('ok');
    break;
  } catch (e) {
    console.log('실패 (' + e.message + ')');
  }
}
if (!osm) {
  console.error('모든 Overpass 엔드포인트 실패. 잠시 후 다시 시도하세요.');
  process.exit(1);
}

const gj = toGeoJSON(osm);
const out = path.join(ROOT, 'data', 'seoul-roads.geojson');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(gj));
console.log(`[done] ${gj.features.length}개 way → ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
