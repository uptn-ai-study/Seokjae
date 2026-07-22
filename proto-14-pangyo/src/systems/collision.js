/**
 * collision.js — 타일 충돌(축 분리 슬라이딩) + 엔티티 원-충돌.
 * 사실적 물리가 아니라 "벽에 긁히며 미끄러지는" 아케이드 감각을 목표로 한다.
 */
import { FREE } from '../map/mapLoader.js';

/** 사각 바디의 프로브 지점(월드 좌표) */
export function probePoints(x, y, angle, len, wid, out = []) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hl = len / 2 - 2;
  const hw = wid / 2 - 2;
  const pts = [
    [hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0],
  ];
  out.length = 0;
  for (const [lx, ly] of pts) out.push([x + lx * c - ly * s, y + lx * s + ly * c]);
  return out;
}

function blocked(map, pts) {
  for (const [px, py] of pts) if (map.solidAtPx(px, py) !== FREE) return true;
  return false;
}

const _pts = [];

/**
 * 이동을 축 분리로 적용하고 벽에 부딪힌 정도를 돌려준다.
 * ent: {x,y,angle,vx,vy,len,wid}
 * @returns {number} 충격 강도(px/s). 0이면 충돌 없음.
 */
export function moveWithTiles(map, ent, dt) {
  let impact = 0;
  const nx = ent.x + ent.vx * dt;
  probePoints(nx, ent.y, ent.angle, ent.len, ent.wid, _pts);
  if (blocked(map, _pts)) {
    impact += Math.abs(ent.vx);
    ent.vx *= -0.22;
  } else ent.x = nx;

  const ny = ent.y + ent.vy * dt;
  probePoints(ent.x, ny, ent.angle, ent.len, ent.wid, _pts);
  if (blocked(map, _pts)) {
    impact += Math.abs(ent.vy);
    ent.vy *= -0.22;
  } else ent.y = ny;

  ent.x = map.clampX(ent.x);
  ent.y = map.clampY(ent.y);
  return impact;
}

/** 원형 바디(보행자·플레이어) 이동 */
export function moveCircle(map, ent, dt, r = 9) {
  const probes = (x, y) => [[x + r, y], [x - r, y], [x, y + r], [x, y - r]];
  let hit = 0;
  const nx = ent.x + ent.vx * dt;
  if (blocked(map, probes(nx, ent.y))) { hit += Math.abs(ent.vx); ent.vx = 0; }
  else ent.x = nx;
  const ny = ent.y + ent.vy * dt;
  if (blocked(map, probes(ent.x, ny))) { hit += Math.abs(ent.vy); ent.vy = 0; }
  else ent.y = ny;
  ent.x = map.clampX(ent.x);
  ent.y = map.clampY(ent.y);
  return hit;
}

/** 두 원형 바디를 밀어내고 상대속도를 돌려준다 */
export function separate(a, b, ra, rb, restitution = 0.6) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = ra + rb;
  if (d >= min || d === 0) return 0;
  dx /= d;
  dy /= d;
  const push = (min - d) / 2;
  const ma = a.mass || 1;
  const mb = b.mass || 1;
  const total = ma + mb;
  a.x -= dx * push * ((2 * mb) / total);
  a.y -= dy * push * ((2 * mb) / total);
  b.x += dx * push * ((2 * ma) / total);
  b.y += dy * push * ((2 * ma) / total);

  const rvx = (b.vx || 0) - (a.vx || 0);
  const rvy = (b.vy || 0) - (a.vy || 0);
  const rel = rvx * dx + rvy * dy;
  if (rel > 0) return 0;
  const j = (-(1 + restitution) * rel) / (1 / ma + 1 / mb);
  a.vx -= (j * dx) / ma;
  a.vy -= (j * dy) / ma;
  b.vx += (j * dx) / mb;
  b.vy += (j * dy) / mb;
  return Math.abs(rel);
}
