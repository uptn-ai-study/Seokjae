/**
 * traffic.js — AI 트래픽 (도로 그래프 위 주행 + 회피)
 *
 *  · 차량은 (엣지, 진행방향, 진행거리 s, 차로 오프셋)으로 표현되는 "레일" 주행
 *  · 앞차 간격 유지는 IDM(Intelligent Driver Model) 근사
 *  · 교차로는 선착순 점유(claim)로 양보 — 완벽하진 않아도 흐름이 자연스럽다
 *  · 플레이어 주변만 활성 업데이트, 멀어지면 앞쪽에 재배치(컬링 + 재활용)
 */

const KMH = 1 / 3.6;

// IDM 파라미터
const IDM = {
  a: 1.6, // 최대 가속 m/s²
  b: 2.4, // 편안한 감속 m/s²
  T: 1.2, // 안전 시간 간격 s
  s0: 3.0, // 최소 정지 간격 m
};

const COLORS = ['#E5E7EB', '#9CA3AF', '#374151', '#5F46FF', '#10B981', '#EF4444', '#F59E0B', '#FFFFFF', '#1F2937', '#60A5FA'];

let seed = 20260721;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

export class Traffic {
  constructor(graph, opts = {}) {
    this.g = graph;
    this.count = opts.count ?? 180;
    this.activeRadius = opts.activeRadius ?? 700; // 업데이트 범위
    this.recycleRadius = opts.recycleRadius ?? 950; // 이 밖이면 재배치
    this.vehicles = [];
    this.buckets = new Map(); // "edgeId_dir" → 차량 배열 (s 오름차순)
    this.claims = new Map(); // 교차점 노드 → 점유 차량
    this.driveEdges = graph.edges.filter((e) => e.len > 25);
  }

  spawnAll(near) {
    this.vehicles.length = 0;
    for (let i = 0; i < this.count; i++) {
      const v = this._makeVehicle();
      this._place(v, near, 80, 700);
      this.vehicles.push(v);
    }
  }

  _makeVehicle() {
    const truck = rnd() < 0.14;
    return {
      edge: null,
      dir: 1,
      s: 0,
      speed: 0,
      x: 0,
      y: 0,
      heading: 0,
      lane: 0,
      len: truck ? 8.2 : 4.3 + rnd() * 0.6,
      width: truck ? 2.4 : 1.8,
      color: truck ? '#6B7280' : COLORS[(rnd() * COLORS.length) | 0],
      truck,
      politeness: 0.85 + rnd() * 0.3,
      wait: 0,
    };
  }

  /** 플레이어 기준 [minD, maxD] 링 안의 임의 도로에 배치 */
  _place(v, near, minD, maxD) {
    for (let tries = 0; tries < 60; tries++) {
      const e = this.driveEdges[(rnd() * this.driveEdges.length) | 0];
      const mid = this.g.pointAt(e, e.len / 2);
      const d = Math.hypot(mid.x - near.x, mid.y - near.y);
      if (d < minD || d > maxD) continue;
      v.edge = e;
      v.dir = e.oneway ? 1 : rnd() < 0.5 ? 1 : -1;
      v.s = rnd() * e.len;
      v.lane = this._laneOffset(e);
      v.speed = e.speed * KMH * (0.6 + rnd() * 0.3);
      v.wait = 0;
      this._sync(v);
      return true;
    }
    v.edge = null;
    return false;
  }

  /** 우측통행 기준 차로 중심까지의 오프셋 (m) */
  _laneOffset(e) {
    if (e.oneway) return (rnd() - 0.5) * Math.max(1.5, e.width * 0.4);
    const half = e.width / 2;
    return half * 0.5; // 중앙선 오른쪽
  }

  _sync(v) {
    const along = v.dir > 0 ? v.s : v.edge.len - v.s;
    const p = this.g.pointAt(v.edge, along, v.dir);
    v.heading = p.heading;
    // 진행방향 기준 오른쪽으로 lane 만큼
    v.x = p.x - Math.sin(p.heading) * v.lane;
    v.y = p.y + Math.cos(p.heading) * v.lane;
  }

  update(dt, player) {
    const g = this.g;

    // --- 1. 재배치(컬링) & 버킷 구성 ---
    this.buckets.clear();
    for (const v of this.vehicles) {
      if (!v.edge) {
        this._place(v, player, 150, this.activeRadius);
        continue;
      }
      const d = Math.hypot(v.x - player.x, v.y - player.y);
      v.active = d < this.activeRadius;
      if (d > this.recycleRadius) {
        this._place(v, player, 250, this.activeRadius);
        continue;
      }
      if (!v.active) continue;
      const key = `${v.edge.id}_${v.dir}`;
      let b = this.buckets.get(key);
      if (!b) this.buckets.set(key, (b = []));
      b.push(v);
    }
    for (const b of this.buckets.values()) b.sort((p, q) => p.s - q.s);

    // --- 2. 교차로 점유 예약 (진입 지점에 가장 가까운 차가 우선) ---
    this.claims.clear();
    for (const b of this.buckets.values()) {
      for (const v of b) {
        const toEnd = v.edge.len - v.s;
        if (toEnd > 18 || v.speed < 0.2) continue;
        const node = g.endNode(v.edge, v.dir);
        const cur = this.claims.get(node);
        if (!cur || toEnd < cur.d) this.claims.set(node, { v, d: toEnd });
      }
    }

    // --- 3. 주행 ---
    for (const b of this.buckets.values()) {
      for (let i = 0; i < b.length; i++) {
        this._drive(b[i], b[i + 1], dt, player);
      }
    }
  }

  _drive(v, leader, dt, player) {
    const g = this.g;
    const e = v.edge;
    const v0 = e.speed * KMH * v.politeness;

    // 앞차와의 간격
    let gap = Infinity;
    let dv = 0;
    if (leader) {
      gap = leader.s - v.s - (leader.len + v.len) / 2;
      dv = v.speed - leader.speed;
    }

    // 플레이어를 앞차로 취급 (같은 방향 전방 원뿔 안)
    const pdx = player.x - v.x;
    const pdy = player.y - v.y;
    const forward = pdx * Math.cos(v.heading) + pdy * Math.sin(v.heading);
    const lateral = Math.abs(-pdx * Math.sin(v.heading) + pdy * Math.cos(v.heading));
    if (forward > 0 && forward < 45 && lateral < 3.2) {
      const pg = forward - (v.len + player.length) / 2;
      if (pg < gap) {
        gap = pg;
        dv = v.speed - Math.max(0, player.speed);
      }
    }

    // 교차로 양보 — 점유권이 없으면 정지선 앞에서 멈추도록 가상 앞차 설정
    const toEnd = e.len - v.s;
    if (toEnd < 18) {
      const node = g.endNode(e, v.dir);
      const claim = this.claims.get(node);
      if (claim && claim.v !== v) {
        const yieldGap = Math.max(0, toEnd - 4);
        if (yieldGap < gap) {
          gap = yieldGap;
          dv = v.speed;
        }
      }
    }

    // IDM
    const sStar = IDM.s0 + Math.max(0, v.speed * IDM.T + (v.speed * dv) / (2 * Math.sqrt(IDM.a * IDM.b)));
    let acc = IDM.a * (1 - Math.pow(v.speed / Math.max(1, v0), 4));
    if (gap < 200) acc -= IDM.a * Math.pow(sStar / Math.max(0.6, gap), 2);
    acc = Math.max(-7, Math.min(IDM.a, acc));

    v.speed = Math.max(0, v.speed + acc * dt);
    v.s += v.speed * dt;

    // 엣지 끝 → 다음 엣지 선택
    if (v.s >= e.len) {
      const over = v.s - e.len;
      const node = g.endNode(e, v.dir);
      const next = this._pickNext(node, e, v.heading);
      if (!next) {
        // 막다른 길 — 유턴
        if (!e.oneway) {
          v.dir = -v.dir;
          v.s = over;
          v.lane = this._laneOffset(e);
        } else {
          v.edge = null;
        }
      } else {
        v.edge = next.edge;
        v.dir = next.dir;
        v.s = Math.min(over, next.edge.len * 0.5);
        v.lane = this._laneOffset(next.edge);
        v.speed = Math.min(v.speed, next.edge.speed * KMH);
      }
    }
    if (v.edge) this._sync(v);
  }

  /** 직진 선호 + 랜덤. 왔던 길로 되돌아가는 선택은 최후의 수단 */
  _pickNext(node, fromEdge, heading) {
    const opts = this.g.outgoing(node);
    if (!opts.length) return null;
    const cands = [];
    let fallback = null;
    for (const o of opts) {
      if (o.edge === fromEdge) {
        fallback = o;
        continue;
      }
      const p = this.g.pointAt(o.edge, 0.5, o.dir);
      const p2 = this.g.pointAt(o.edge, Math.min(8, o.edge.len), o.dir);
      const h = Math.atan2(p2.y - p.y, p2.x - p.x);
      let diff = Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)));
      // 직진(각도차 0)에 큰 가중치
      cands.push({ o, w: Math.pow(Math.max(0.05, 1 - diff / Math.PI), 3) + 0.08 });
    }
    if (!cands.length) return fallback;
    let total = 0;
    for (const c of cands) total += c.w;
    let r = rnd() * total;
    for (const c of cands) {
      r -= c.w;
      if (r <= 0) return c.o;
    }
    return cands[cands.length - 1].o;
  }

  /** 플레이어 ↔ AI 충돌 (원-원 근사) */
  resolvePlayerCollision(player) {
    let hit = false;
    for (const v of this.vehicles) {
      if (!v.edge || !v.active) continue;
      const dx = player.x - v.x;
      const dy = player.y - v.y;
      const r = (player.length + v.len) / 2 * 0.62 + 0.4;
      const d = Math.hypot(dx, dy);
      if (d > r || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      player.bump(nx, ny, (r - d) / r + 0.5);
      v.speed *= 0.4;
      hit = true;
    }
    return hit;
  }

  /** 화면 안 차량만 (렌더용) */
  visible(rect, out = []) {
    out.length = 0;
    for (const v of this.vehicles) {
      if (!v.edge) continue;
      if (v.x < rect.minX || v.x > rect.maxX || v.y < rect.minY || v.y > rect.maxY) continue;
      out.push(v);
    }
    return out;
  }
}
