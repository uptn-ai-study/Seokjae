/**
 * gen-city.js — 판교역 반경 5km 모티프 도시를 city.json 으로 생성한다.
 *
 * 게임 코드는 이 파일이 만든 JSON 만 읽는다. 도시를 바꾸고 싶으면
 * 이 스크립트의 파라미터(또는 JSON 자체)만 고치면 되고 게임 코드는 건드리지 않는다.
 *
 *   node tools/gen-city.js
 *
 * 실제 지형지물은 "모티프"로만 참조하며 상표·기업 실명은 쓰지 않는다.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── 파라미터 ────────────────────────────────────────────────────────────────
const W = 512; // 타일 가로
const H = 512; // 타일 세로
const TILE = 32; // 픽셀
const METERS_PER_TILE = 20; // 512 * 20m ≒ 10.2km → 반경 5km
const STREET = 12; // 일반 도로 간격(타일)
const AVENUE_EVERY = 4; // 4번째 도로마다 대로
const RIVER_W = 6; // 탄천 모티프 반폭
const HIGHWAY_Y = 470; // 고속 주행 구간(분당수서로 모티프)
const HIGHWAY_HW = 4;

// 타일 코드
const T = {
  ROAD: '#',
  CROSS: 'x',
  WALK: '-',
  GRASS: 'g',
  WATER: 'w',
  PARK_LOT: 'p',
  PLAZA: 'z',
  LOT: '.',
};

// 결정론적 난수 — 같은 시드는 항상 같은 도시를 만든다.
let seed = 20260722;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ── 구역(district) ─────────────────────────────────────────────────────────
// 앞에 있는 것이 우선. 게임은 bounds 로 point-in-rect 판정한다.
const districts = [
  { id: 'station-core', name: 'Station Core', bounds: [196, 196, 120, 120], theme: 'commercial' },
  { id: 'techno-valley', name: 'Techno Valley', bounds: [40, 40, 200, 180], theme: 'office' },
  { id: 'baekhyeon', name: 'Baekhyeon', bounds: [270, 30, 210, 200], theme: 'residential' },
  { id: 'sampyeong', name: 'Sampyeong', bounds: [30, 240, 190, 200], theme: 'residential' },
  { id: 'unjung-hills', name: 'Unjung Hills', bounds: [250, 250, 240, 190], theme: 'suburb' },
  { id: 'seohyeon-connector', name: 'Seohyeon Connector', bounds: [0, 440, 512, 72], theme: 'highway' },
];
const districtAt = (tx, ty) => {
  for (const d of districts) {
    const [x, y, w, h] = d.bounds;
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) return d;
  }
  return { id: 'outskirts', name: 'Outskirts', theme: 'suburb' };
};

// ── 도로 격자 ──────────────────────────────────────────────────────────────
function axis(t) {
  const k = Math.round(t / STREET);
  const c = k * STREET;
  const d = t - c;
  const avenue = k % AVENUE_EVERY === 0;
  const half = avenue ? 2 : 1;
  return { k, c, d, avenue, road: d >= -half && d < half, walk: d >= -half - 1 && d < half + 1 };
}

const riverX = (ty) => 300 + 46 * Math.sin(ty / 78) + 14 * Math.sin(ty / 23);

// ── 지면 레이어 ────────────────────────────────────────────────────────────
const rows = [];
for (let ty = 0; ty < H; ty++) {
  const rx = riverX(ty);
  let row = '';
  for (let tx = 0; tx < W; tx++) {
    const ax = axis(tx);
    const ay = axis(ty);
    const onHighway = Math.abs(ty - HIGHWAY_Y) <= HIGHWAY_HW;
    const nearHighway = Math.abs(ty - HIGHWAY_Y) <= HIGHWAY_HW + 1;
    const isRoad = ax.road || ay.road || onHighway;
    const isWalk = ax.walk || ay.walk || nearHighway;
    const inRiver = Math.abs(tx - rx) < RIVER_W;
    const bridge = ax.avenue && ax.walk; // 대로만 다리로 강을 건넌다

    let t;
    if (isRoad) t = ax.road && ay.walk && !ay.road ? T.CROSS : ay.road && ax.walk && !ax.road ? T.CROSS : T.ROAD;
    else if (isWalk) t = T.WALK;
    else t = T.LOT;

    if (inRiver && !bridge) {
      t = T.WATER;
    } else if (!isRoad && !isWalk) {
      const d = districtAt(tx, ty);
      const nearRiver = Math.abs(tx - rx) < RIVER_W + 8;
      if (nearRiver) t = T.GRASS;
      else if (d.id === 'station-core' && Math.abs(tx - 256) < 12 && Math.abs(ty - 256) < 12) t = T.PLAZA;
      else if (d.theme === 'suburb' && rnd() < 0.62) t = T.GRASS;
      else if (rnd() < 0.12) t = T.PARK_LOT;
    }
    row += t;
  }
  rows.push(row);
}
const groundAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H ? T.WATER : rows[ty][tx]);

// ── 건물 배치 ──────────────────────────────────────────────────────────────
// 블록(도로 사이 빈 땅) 안을 잘라 지붕 스프라이트용 사각형을 만든다.
const themeSpec = {
  office: { min: 5, max: 10, height: [3, 9], fill: 0.9, palette: 0 },
  commercial: { min: 4, max: 8, height: [2, 7], fill: 0.92, palette: 1 },
  residential: { min: 4, max: 7, height: [2, 6], fill: 0.8, palette: 2 },
  suburb: { min: 3, max: 6, height: [1, 4], fill: 0.62, palette: 3 },
  highway: { min: 4, max: 8, height: [1, 3], fill: 0.25, palette: 3 },
};

const buildings = [];
const blockStep = STREET;
for (let by = 0; by < H; by += blockStep) {
  for (let bx = 0; bx < W; bx += blockStep) {
    // 블록 내부에서 실제로 지을 수 있는 땅(LOT)의 사각 영역을 찾는다
    let x0 = bx, y0 = by, x1 = bx + blockStep - 1, y1 = by + blockStep - 1;
    while (x0 <= x1 && groundAt(x0, (y0 + y1) >> 1) !== T.LOT) x0++;
    while (x1 >= x0 && groundAt(x1, (y0 + y1) >> 1) !== T.LOT) x1--;
    while (y0 <= y1 && groundAt((x0 + x1) >> 1, y0) !== T.LOT) y0++;
    while (y1 >= y0 && groundAt((x0 + x1) >> 1, y1) !== T.LOT) y1--;
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    if (bw < 3 || bh < 3) continue;

    const d = districtAt(bx + 6, by + 6);
    const spec = themeSpec[d.theme] || themeSpec.suburb;
    if (rnd() > spec.fill) continue;

    // 블록을 1~4개로 분할
    const cols = bw >= 6 ? ri(1, 2) : 1;
    const rowsN = bh >= 6 ? ri(1, 2) : 1;
    const cw = Math.floor(bw / cols);
    const ch = Math.floor(bh / rowsN);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rowsN; r++) {
        if (rnd() > spec.fill) continue;
        const pad = rnd() < 0.5 ? 0 : 1;
        const w = Math.min(spec.max, cw - pad);
        const h = Math.min(spec.max, ch - pad);
        if (w < 2 || h < 2) continue;
        const x = x0 + c * cw + Math.floor((cw - w) / 2);
        const y = y0 + r * ch + Math.floor((ch - h) / 2);
        // 물 위에는 짓지 않는다
        if (groundAt(x, y) === T.WATER || groundAt(x + w - 1, y + h - 1) === T.WATER) continue;
        buildings.push({
          x, y, w, h,
          z: ri(spec.height[0], spec.height[1]),
          p: spec.palette,
          v: ri(0, 3), // 색 변주
        });
      }
    }
  }
}

// 랜드마크 타워 — 광장 한가운데 (가상 명칭: Pangyo Spire)
buildings.push({ x: 252, y: 252, w: 8, h: 8, z: 16, p: 0, v: 1, landmark: 'Pangyo Spire' });

// ── 소품(가로수·조경) ──────────────────────────────────────────────────────
// 공원과 강변이 허전하지 않도록. 충돌은 없고 렌더 전용이다.
const props = [];
for (let ty = 2; ty < H - 2; ty += 1) {
  for (let tx = 2; tx < W - 2; tx += 1) {
    const g = groundAt(tx, ty);
    if (g === T.GRASS && rnd() < 0.09) {
      props.push({ x: tx * TILE + ri(6, 26), y: ty * TILE + ri(6, 26), r: ri(7, 13), k: 0 });
    } else if (g === T.WALK && rnd() < 0.012) {
      props.push({ x: tx * TILE + 16, y: ty * TILE + 16, r: 8, k: 1 }); // 가로수
    }
  }
}

// ── 도로 그래프 (AI 주행 / A* 추격) ────────────────────────────────────────
const nodes = [];
const nodeId = new Map();
const kmax = Math.floor((W - 1) / STREET);
for (let ky = 0; ky <= kmax; ky++) {
  for (let kx = 0; kx <= kmax; kx++) {
    const tx = kx * STREET;
    const ty = ky * STREET;
    if (groundAt(tx, ty) === T.WATER) continue;
    nodeId.set(`${kx},${ky}`, nodes.length);
    nodes.push([tx, ty]);
  }
}
const edges = [];
const passable = (ax, ay, bx, by) => {
  // 두 노드 사이 직선상에 물이 있으면 통행 불가
  const steps = STREET;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(ax + ((bx - ax) * i) / steps);
    const y = Math.round(ay + ((by - ay) * i) / steps);
    if (groundAt(x, y) === T.WATER) return false;
  }
  return true;
};
for (let ky = 0; ky <= kmax; ky++) {
  for (let kx = 0; kx <= kmax; kx++) {
    const a = nodeId.get(`${kx},${ky}`);
    if (a === undefined) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const b = nodeId.get(`${kx + dx},${ky + dy}`);
      if (b === undefined) continue;
      if (!passable(...nodes[a], ...nodes[b])) continue;
      const avenue = dx ? ky % AVENUE_EVERY === 0 : kx % AVENUE_EVERY === 0;
      edges.push([a, b, avenue ? 2 : 1]); // 2 = 대로(빠름)
    }
  }
}

// ── 스폰 ───────────────────────────────────────────────────────────────────
const roadNodes = nodes.map((n, i) => i);
const vehicleTypes = ['sedan', 'sports', 'suv', 'bus', 'truck', 'moto', 'scooter'];
const parked = [];
for (let i = 0; i < 420; i++) {
  const n = nodes[roadNodes[ri(0, roadNodes.length - 1)]];
  const off = ri(3, 8) * (rnd() < 0.5 ? -1 : 1);
  const horiz = rnd() < 0.5;
  const tx = n[0] + (horiz ? off : 0);
  const ty = n[1] + (horiz ? 0 : off);
  const g = groundAt(tx, ty);
  if (g !== T.ROAD && g !== T.PARK_LOT) continue;
  const d = districtAt(tx, ty);
  let type = pick(vehicleTypes);
  if (d.theme === 'office') type = pick(['sedan', 'sedan', 'suv', 'scooter', 'sports']);
  if (d.theme === 'suburb') type = pick(['suv', 'truck', 'sedan', 'moto']);
  if (d.theme === 'highway') type = pick(['sports', 'truck', 'bus', 'sedan']);
  parked.push({ type, pos: [tx * TILE + TILE / 2, ty * TILE + TILE / 2], rot: horiz ? 0 : 90 });
}

// 플레이어 시작점 — 스테이션 코어 광장 옆 인도
let playerSpawn = [256 * TILE, 232 * TILE];
outer: for (let r = 0; r < 40; r++) {
  for (let a = 0; a < 24; a++) {
    const tx = Math.round(256 + r * Math.cos((a / 24) * Math.PI * 2));
    const ty = Math.round(240 + r * Math.sin((a / 24) * Math.PI * 2));
    if (groundAt(tx, ty) === T.WALK) {
      playerSpawn = [tx * TILE + TILE / 2, ty * TILE + TILE / 2];
      break outer;
    }
  }
}

// 랜드마크 — 미니맵/네비 표시용 (모두 가상 명칭)
const landmarks = [
  { id: 'spire', name: 'Pangyo Spire', pos: [256 * TILE, 256 * TILE] },
  { id: 'mall', name: 'Crescent Mall', pos: [300 * TILE, 236 * TILE] },
  { id: 'valley', name: 'Techno Valley Plaza', pos: [132 * TILE, 132 * TILE] },
  { id: 'river', name: 'Tancheon Riverside', pos: [Math.round(riverX(360)) * TILE, 360 * TILE] },
  { id: 'hills', name: 'Unjung Hills Lookout', pos: [372 * TILE, 348 * TILE] },
  { id: 'connector', name: 'Seohyeon Connector', pos: [120 * TILE, HIGHWAY_Y * TILE] },
];

// 세차장/은신처 모티프 — 도달하면 수배가 풀린다
const covered = (tx, ty) =>
  buildings.some((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
const hideouts = [];
for (const [hx, hy] of [[120, 120], [380, 130], [140, 380], [390, 380], [256, 300]]) {
  let found = null;
  for (let r = 0; r < 30 && !found; r++) {
    for (let a = 0; a < 20; a++) {
      const tx = Math.round(hx + r * Math.cos((a / 20) * Math.PI * 2));
      const ty = Math.round(hy + r * Math.sin((a / 20) * Math.PI * 2));
      if (groundAt(tx, ty) === T.PARK_LOT && !covered(tx, ty)) {
        found = [tx * TILE + TILE / 2, ty * TILE + TILE / 2];
        break;
      }
    }
  }
  if (found) hideouts.push({ pos: found, name: 'Wash Point' });
}

const city = {
  meta: {
    id: 'pangyo-5km',
    displayName: 'Pangyo',
    tileSize: TILE,
    width: W,
    height: H,
    originLatLng: [37.3947, 127.1112],
    metersPerTile: METERS_PER_TILE,
    streetSpacing: STREET,
    avenueEvery: AVENUE_EVERY,
    tileCodes: T,
    generatedBy: 'tools/gen-city.js',
  },
  layers: [
    { name: 'ground', type: 'tilemap', data: rows },
    { name: 'buildings', type: 'objects', data: buildings },
    { name: 'props', type: 'objects', data: props },
    // collision 은 ground(물) + buildings 로 로더가 파생시킨다 (데이터 중복 방지)
    { name: 'collision', type: 'grid', derive: 'ground+buildings' },
    { name: 'roads', type: 'graph', data: { nodes, edges } },
  ],
  spawns: { player: playerSpawn, vehicles: parked },
  districts,
  landmarks,
  hideouts,
};

const out = resolve(__dir, '../assets/data/city.pangyo.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(city));
const kb = (JSON.stringify(city).length / 1024).toFixed(0);
console.log(`city.pangyo.json 생성 완료 — ${kb}KB / 건물 ${buildings.length} / 노드 ${nodes.length} / 엣지 ${edges.length} / 주차 ${parked.length}`);
