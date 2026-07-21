#!/usr/bin/env node
/**
 * Overpass API → data/seoul-areas.geojson
 *
 *   node scripts/fetch-areas.js
 *
 * 건물 / 공원 / 물 / 광장 등 면(面) 피처를 받아옵니다.
 * 도로와 마찬가지로 한 번 받아두면 이후엔 네트워크가 필요 없습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const KEEP_TAGS = [
  'building', 'building:levels', 'height', 'name', 'name:en',
  'leisure', 'landuse', 'natural', 'waterway', 'place', 'historic',
  'amenity', 'tourism', 'office', 'shop',
];

function loadQuery() {
  return fs
    .readFileSync(path.join(ROOT, 'data', 'overpass-query-areas.txt'), 'utf8')
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
      'User-Agent': 'proto-13-drive/1.0 (osm area extractor)',
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
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
    const g = el.geometry;
    // 닫힌 폴리곤만 (건물/영역)
    const closed = g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
    if (!closed) continue;
    const props = { id: el.id };
    for (const k of KEEP_TAGS) if (el.tags && el.tags[k] != null) props[k] = el.tags[k];
    features.push({
      type: 'Feature',
      properties: props,
      geometry: { type: 'Polygon', coordinates: [g.map((p) => [+p.lon.toFixed(7), +p.lat.toFixed(7)])] },
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
const out = path.join(ROOT, 'data', 'seoul-areas.geojson');
fs.writeFileSync(out, JSON.stringify(gj));
console.log(`[done] ${gj.features.length}개 폴리곤 → ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
