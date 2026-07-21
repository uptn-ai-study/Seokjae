#!/usr/bin/env node
/**
 * data/seoul-areas.geojson → assets/areas.json
 *
 *   node scripts/build-areas.js
 *
 * 하는 일
 *  1) 위경도 → 월드 좌표(m) 투영 (build-graph.js 와 동일한 중심/식)
 *  2) 면적 계산 후 자잘한 폴리곤 제거 (이름 있는 건물은 작아도 보존)
 *  3) Douglas-Peucker 단순화 + 좌표 반올림으로 용량 축소
 *  4) 종류 분류(건물/주요건물/공원/물/광장) + 층수 → 게임 렌더용 JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CENTER = { lat: 37.5665, lon: 126.978 };
const EPS = 1.6; // 단순화 허용 오차 (m)
const MIN_BUILDING = 220; // m² — 이보다 작은 무명 건물은 버림
const MIN_AREA = 250; // m² — 공원/물 등
const MAJOR_AREA = 2200; // m² — 라벨을 붙일 "주요 건물" 기준

const R = 6378137;
const D2R = Math.PI / 180;
const kx = Math.cos(CENTER.lat * D2R) * R * D2R;
const ky = R * D2R;
const project = (lon, lat) => [(lon - CENTER.lon) * kx, -(lat - CENTER.lat) * ky];

// ---------- 유틸 ----------
function polygonArea(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(s) / 2;
}

function centroid(pts) {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += f;
    cx += (pts[j][0] + pts[i][0]) * f;
    cy += (pts[j][1] + pts[i][1]) * f;
  }
  a *= 3;
  return a === 0 ? pts[0] : [cx / a, cy / a];
}

/** Douglas-Peucker */
function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const ax = pts[s][0];
    const ay = pts[s][1];
    const bx = pts[e][0];
    const by = pts[e][1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      let t = l2 > 0 ? ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(pts[i][0] - (ax + dx * t), pts[i][1] - (ay + dy * t));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// ---------- 분류 ----------
// 0=건물 1=주요건물 2=공원/녹지 3=물 4=광장
function classify(p, area) {
  if (p.natural === 'water' || p.waterway === 'riverbank') return 3;
  if (p.leisure === 'park' || p.leisure === 'garden' || /grass|forest|cemetery|recreation_ground/.test(p.landuse || '')) return 2;
  if (p.place === 'square') return 4;
  if (p.building) {
    const landmark =
      p.historic === 'city_gate' ||
      p.tourism === 'attraction' ||
      /^(civic|government|palace|cathedral|temple|train_station|stadium|hotel|commercial|office|retail)$/.test(p.building);
    if (area >= MAJOR_AREA || (p.name && (landmark || area >= 900))) return 1;
    return 0;
  }
  if (p.leisure === 'stadium') return 1;
  return -1;
}

// ---------- 실행 ----------
const src = path.join(ROOT, 'data', 'seoul-areas.geojson');
if (!fs.existsSync(src)) {
  console.error('data/seoul-areas.geojson 이 없습니다. 먼저 `node scripts/fetch-areas.js` 를 실행하세요.');
  process.exit(1);
}
const gj = JSON.parse(fs.readFileSync(src, 'utf8'));

const out = [];
const stat = [0, 0, 0, 0, 0];
for (const f of gj.features) {
  const ring = f.geometry.coordinates[0];
  if (!ring || ring.length < 4) continue;
  let pts = ring.slice(0, -1).map(([lon, lat]) => project(lon, lat)); // 닫는 점 제거
  const area = polygonArea(pts);
  const p = f.properties;
  const t = classify(p, area);
  if (t < 0) continue;
  if (t === 0 && area < MIN_BUILDING && !p.name) continue;
  if (t !== 0 && t !== 1 && area < MIN_AREA) continue;

  pts = simplify(pts, EPS);
  if (pts.length < 3) continue;

  const o = { t, p: pts.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) };
  const levels = parseInt(p['building:levels'], 10);
  if (Number.isFinite(levels) && levels > 0) o.lv = Math.min(80, levels);
  if (t === 1 || t === 2 || t === 3 || t === 4) {
    if (p.name) o.n = p.name;
    const c = centroid(pts);
    o.c = [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10];
    o.a = Math.round(area);
  }
  out.push(o);
  stat[t]++;
}

// 큰 것부터 그리도록 정렬(작은 건물이 큰 면적에 묻히지 않게)
out.sort((a, b) => (b.a || 0) - (a.a || 0));

const outPath = path.join(ROOT, 'assets', 'areas.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ meta: { center: CENTER, generated: new Date().toISOString().slice(0, 10) }, areas: out }));

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`[done] 건물 ${stat[0]} · 주요건물 ${stat[1]} · 녹지 ${stat[2]} · 물 ${stat[3]} · 광장 ${stat[4]} → assets/areas.json (${kb} KB)`);
