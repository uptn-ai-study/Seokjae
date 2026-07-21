#!/usr/bin/env node
/**
 * data/seoul-roads.geojson → assets/graph.json
 *
 *   node scripts/build-graph.js
 *
 * 하는 일
 *  1) 위경도 → 중심 기준 로컬 평면(미터) 투영 (equirectangular 근사)
 *  2) OSM node id + 좌표 그리드 스냅으로 교차점 병합
 *  3) way를 교차점 기준으로 잘라 엣지(도로 구간) 생성 — 곡선 형상 유지
 *  4) oneway / junction=roundabout 방향 반영
 *  5) 2차선 이하 자투리 제거 + 최대 연결요소만 남기고 정리
 *  6) 경량 JSON 출력
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CENTER = { lat: 37.5665, lon: 126.978 }; // 서울시청
const SNAP = 3; // m — 이 거리 안의 노드는 같은 교차점으로 병합
const MIN_EDGE_LEN = 4; // m — 이보다 짧은 자투리 엣지는 버림

// 도로 종류별 게임 파라미터 (폭 m, 제한속도 km/h, 렌더 우선순위)
const ROAD_CLASS = {
  motorway: { w: 18, speed: 90, rank: 0 },
  trunk: { w: 16, speed: 80, rank: 1 },
  primary: { w: 14, speed: 70, rank: 2 },
  secondary: { w: 12, speed: 60, rank: 3 },
  tertiary: { w: 10, speed: 50, rank: 4 },
  unclassified: { w: 8, speed: 40, rank: 5 },
  residential: { w: 7, speed: 30, rank: 6 },
  living_street: { w: 6, speed: 20, rank: 7 },
};
const LINK_OF = {
  motorway_link: 'motorway',
  trunk_link: 'trunk',
  primary_link: 'primary',
  secondary_link: 'secondary',
  tertiary_link: 'tertiary',
};

// ---------- 투영 ----------
const R = 6378137;
const D2R = Math.PI / 180;
const kx = Math.cos(CENTER.lat * D2R) * R * D2R; // 경도 1도당 m
const ky = R * D2R; // 위도 1도당 m
const project = (lon, lat) => [(lon - CENTER.lon) * kx, -(lat - CENTER.lat) * ky]; // y는 화면 기준(남쪽이 +)

// ---------- 로드 ----------
const gjPath = path.join(ROOT, 'data', 'seoul-roads.geojson');
if (!fs.existsSync(gjPath)) {
  console.error('data/seoul-roads.geojson 이 없습니다. 먼저 `node scripts/fetch-osm.js` 를 실행하세요.');
  process.exit(1);
}
const gj = JSON.parse(fs.readFileSync(gjPath, 'utf8'));

// ---------- 1. 정점 등록 (osm node id + 그리드 스냅) ----------
const verts = []; // {x,y,ways:Set}
const byOsmId = new Map(); // osm node id → vertex index
const grid = new Map(); // 스냅 셀 → vertex index[]
const cellKey = (x, y) => `${Math.round(x / SNAP)},${Math.round(y / SNAP)}`;

function addVertex(x, y, osmId) {
  if (osmId != null && byOsmId.has(osmId)) return byOsmId.get(osmId);
  // 주변 9칸에서 가까운 정점 탐색
  const cx = Math.round(x / SNAP);
  const cy = Math.round(y / SNAP);
  let best = -1;
  let bestD = SNAP * SNAP;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const list = grid.get(`${cx + dx},${cy + dy}`);
      if (!list) continue;
      for (const i of list) {
        const d = (verts[i].x - x) ** 2 + (verts[i].y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  let idx = best;
  if (idx < 0) {
    idx = verts.length;
    verts.push({ x, y, deg: 0 });
    const k = cellKey(x, y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(idx);
  }
  if (osmId != null) byOsmId.set(osmId, idx);
  return idx;
}

// way별 정점 인덱스 배열 + 각 정점이 몇 개 way에 등장하는지 카운트
const wayVerts = [];
const wayCount = new Map(); // vertex idx → way 등장 수

for (const f of gj.features) {
  const hw = f.properties.highway;
  const cls = ROAD_CLASS[hw] ? hw : LINK_OF[hw];
  if (!cls || !ROAD_CLASS[cls]) continue;
  const coords = f.geometry.coordinates;
  const osmNodes = f.properties.nodes || [];
  const vs = [];
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const [x, y] = project(lon, lat);
    const v = addVertex(x, y, osmNodes[i]);
    if (vs.length === 0 || vs[vs.length - 1] !== v) vs.push(v);
  }
  if (vs.length < 2) continue;
  const seen = new Set();
  for (const v of vs) {
    if (seen.has(v)) continue;
    seen.add(v);
    wayCount.set(v, (wayCount.get(v) || 0) + 1);
  }
  wayVerts.push({ f, cls, vs });
}

// ---------- 2. 교차점 판정 ----------
const isJunction = new Set();
for (const { vs } of wayVerts) {
  isJunction.add(vs[0]);
  isJunction.add(vs[vs.length - 1]);
  for (const v of vs) if ((wayCount.get(v) || 0) > 1) isJunction.add(v);
}

// ---------- 3. way를 교차점 기준으로 분할 → 엣지 ----------
const onewayOf = (p) => {
  const ow = String(p.oneway ?? '').toLowerCase();
  if (p.junction === 'roundabout' || p.junction === 'circular') return 1;
  if (ow === 'yes' || ow === 'true' || ow === '1') return 1;
  if (ow === '-1' || ow === 'reverse') return -1;
  return 0;
};

const dist = (a, b) => Math.hypot(verts[a].x - verts[b].x, verts[a].y - verts[b].y);

const rawEdges = [];
for (const { f, cls, vs } of wayVerts) {
  const p = f.properties;
  const ow = onewayOf(p);
  const lanes = Math.max(1, Math.min(8, parseInt(p.lanes, 10) || (ROAD_CLASS[cls].w >= 12 ? 3 : ROAD_CLASS[cls].w >= 8 ? 2 : 1)));
  let maxspeed = parseInt(p.maxspeed, 10);
  if (!Number.isFinite(maxspeed) || maxspeed <= 0) maxspeed = ROAD_CLASS[cls].speed;

  let start = 0;
  for (let i = 1; i < vs.length; i++) {
    if (!isJunction.has(vs[i]) && i !== vs.length - 1) continue;
    const seg = vs.slice(start, i + 1);
    start = i;
    if (seg.length < 2) continue;
    let len = 0;
    for (let k = 1; k < seg.length; k++) len += dist(seg[k - 1], seg[k]);
    if (len < MIN_EDGE_LEN) continue;
    const pts = ow === -1 ? seg.slice().reverse() : seg;
    rawEdges.push({
      pts,
      cls,
      name: p.name || '',
      oneway: ow !== 0 ? 1 : 0,
      lanes,
      maxspeed,
      len: Math.round(len * 10) / 10,
    });
  }
}

// 중복 엣지 제거 (같은 두 교차점 + 같은 종류)
const dedup = new Map();
for (const e of rawEdges) {
  const a = e.pts[0];
  const b = e.pts[e.pts.length - 1];
  if (a === b && e.len < 20) continue; // 아주 작은 루프 제거
  const key = `${Math.min(a, b)}_${Math.max(a, b)}_${e.cls}_${Math.round(e.len)}`;
  if (dedup.has(key)) continue;
  dedup.set(key, e);
}
let edges = [...dedup.values()];

// ---------- 4. 최대 연결요소만 남기기 ----------
const adj = new Map();
const link = (a, b, i) => {
  if (!adj.has(a)) adj.set(a, []);
  adj.get(a).push([b, i]);
};
edges.forEach((e, i) => {
  const a = e.pts[0];
  const b = e.pts[e.pts.length - 1];
  link(a, b, i);
  link(b, a, i);
});

let bestComp = null;
const compOf = new Map();
for (const startV of adj.keys()) {
  if (compOf.has(startV)) continue;
  const comp = [];
  const stack = [startV];
  compOf.set(startV, true);
  while (stack.length) {
    const v = stack.pop();
    comp.push(v);
    for (const [n] of adj.get(v) || []) {
      if (!compOf.has(n)) {
        compOf.set(n, true);
        stack.push(n);
      }
    }
  }
  if (!bestComp || comp.length > bestComp.length) bestComp = comp;
}
const keep = new Set(bestComp);
edges = edges.filter((e) => keep.has(e.pts[0]));

// ---------- 5. 사용된 정점만 재번호 ----------
const used = new Set();
for (const e of edges) for (const v of e.pts) used.add(v);
const remap = new Map();
const outNodes = [];
for (const v of used) {
  remap.set(v, outNodes.length);
  outNodes.push(verts[v]);
}

const r1 = (n) => Math.round(n * 10) / 10;
const outEdges = edges.map((e) => {
  const pts = e.pts.map((v) => remap.get(v));
  const o = {
    a: pts[0],
    b: pts[pts.length - 1],
    c: e.cls,
    len: e.len,
    lanes: e.lanes,
    sp: e.maxspeed,
  };
  if (e.oneway) o.ow = 1;
  if (e.name) o.n = e.name;
  if (pts.length > 2) o.g = pts.slice(1, -1); // 중간 형상점
  return o;
});

// 경계
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
for (const n of outNodes) {
  minX = Math.min(minX, n.x);
  minY = Math.min(minY, n.y);
  maxX = Math.max(maxX, n.x);
  maxY = Math.max(maxY, n.y);
}

const graph = {
  meta: {
    source: 'OpenStreetMap (ODbL) via Overpass API',
    center: CENTER,
    generated: new Date().toISOString().slice(0, 10),
    bounds: { minX: r1(minX), minY: r1(minY), maxX: r1(maxX), maxY: r1(maxY) },
    roadClasses: ROAD_CLASS,
  },
  nodes: outNodes.map((n) => [r1(n.x), r1(n.y)]),
  edges: outEdges,
};

const outPath = path.join(ROOT, 'assets', 'graph.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(graph));

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`[done] 노드 ${graph.nodes.length} · 엣지 ${graph.edges.length} → assets/graph.json (${kb} KB)`);
console.log(
  `       영역 ${Math.round(maxX - minX)}m x ${Math.round(maxY - minY)}m · 일방통행 ${outEdges.filter((e) => e.ow).length}개`
);
