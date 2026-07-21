/**
 * graph.js — graph.json 로드 & 도로 그래프 유틸
 *
 * 데이터 구조
 *   nodes : [x, y] 미터 (월드 좌표)
 *   edges : 교차점~교차점 도로 구간. 중간 형상점(g)으로 곡선 유지
 *   adj   : 교차점 → 진출 가능한 (엣지, 진행방향) 목록. oneway 반영
 *   grid  : 100m 격자 공간 인덱스 (뷰포트 컬링 / 최근접 도로 탐색용)
 */
import { closestOnSegment } from './geo.js';

export const CELL = 100; // 공간 인덱스 셀 크기 (m)

export class RoadGraph {
  constructor(raw) {
    this.meta = raw.meta;
    this.classes = raw.meta.roadClasses;

    // --- 노드 ---
    const n = raw.nodes.length;
    this.nx = new Float64Array(n);
    this.ny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.nx[i] = raw.nodes[i][0];
      this.ny[i] = raw.nodes[i][1];
    }

    // --- 엣지 ---
    this.edges = raw.edges.map((e, i) => {
      const idx = [e.a, ...(e.g || []), e.b];
      const poly = new Float64Array(idx.length * 2);
      for (let k = 0; k < idx.length; k++) {
        poly[k * 2] = this.nx[idx[k]];
        poly[k * 2 + 1] = this.ny[idx[k]];
      }
      // 누적 길이
      const cum = new Float64Array(idx.length);
      for (let k = 1; k < idx.length; k++) {
        cum[k] = cum[k - 1] + Math.hypot(poly[k * 2] - poly[k * 2 - 2], poly[k * 2 + 1] - poly[k * 2 - 1]);
      }
      const cls = this.classes[e.c] || this.classes.residential;
      return {
        id: i,
        a: e.a,
        b: e.b,
        poly,
        cum,
        len: cum[cum.length - 1],
        cls: e.c,
        width: cls.w,
        speed: e.sp || cls.speed, // km/h
        lanes: e.lanes || 2,
        oneway: !!e.ow,
        name: e.n || '',
        rank: cls.rank,
      };
    });

    // --- 인접 리스트 (교차점만) ---
    this.adj = new Map();
    const push = (node, edge, dir) => {
      let l = this.adj.get(node);
      if (!l) this.adj.set(node, (l = []));
      l.push({ edge, dir });
    };
    for (const e of this.edges) {
      push(e.a, e, 1);
      if (!e.oneway) push(e.b, e, -1);
    }
    this.junctions = [...this.adj.keys()];

    // --- 공간 인덱스 ---
    this.grid = new Map();
    for (const e of this.edges) {
      const cells = new Set();
      for (let k = 0; k < e.poly.length; k += 2) {
        cells.add(this._key(e.poly[k], e.poly[k + 1]));
        if (k + 2 < e.poly.length) {
          // 긴 선분이 셀을 건너뛰지 않도록 중간점도 등록
          const steps = Math.ceil(Math.hypot(e.poly[k + 2] - e.poly[k], e.poly[k + 3] - e.poly[k + 1]) / CELL);
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            cells.add(this._key(e.poly[k] + (e.poly[k + 2] - e.poly[k]) * t, e.poly[k + 1] + (e.poly[k + 3] - e.poly[k + 1]) * t));
          }
        }
      }
      for (const c of cells) {
        let l = this.grid.get(c);
        if (!l) this.grid.set(c, (l = []));
        l.push(e);
      }
    }

    this.bounds = raw.meta.bounds;
  }

  _key(x, y) {
    return `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  }

  /** 사각 영역과 겹치는 엣지들 (뷰포트 컬링) */
  queryRect(minX, minY, maxX, maxY, out = []) {
    out.length = 0;
    const seen = new Set();
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const y0 = Math.floor(minY / CELL);
    const y1 = Math.floor(maxY / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const l = this.grid.get(`${cx},${cy}`);
        if (!l) continue;
        for (const e of l) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          out.push(e);
        }
      }
    }
    return out;
  }

  /**
   * 점에서 가장 가까운 도로 위 지점.
   * @returns {{edge,s,x,y,dist,heading}|null}
   */
  nearest(px, py, maxDist = 120) {
    let best = null;
    let bestD2 = maxDist * maxDist;
    const rad = Math.ceil(maxDist / CELL);
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    const seen = new Set();
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dy = -rad; dy <= rad; dy++) {
        const l = this.grid.get(`${cx + dx},${cy + dy}`);
        if (!l) continue;
        for (const e of l) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          for (let k = 0; k + 3 < e.poly.length; k += 2) {
            const r = closestOnSegment(px, py, e.poly[k], e.poly[k + 1], e.poly[k + 2], e.poly[k + 3]);
            if (r.d2 < bestD2) {
              bestD2 = r.d2;
              const segLen = e.cum[k / 2 + 1] - e.cum[k / 2];
              best = {
                edge: e,
                s: e.cum[k / 2] + segLen * r.t,
                x: r.x,
                y: r.y,
                heading: Math.atan2(e.poly[k + 3] - e.poly[k + 1], e.poly[k + 2] - e.poly[k]),
              };
            }
          }
        }
      }
    }
    if (best) best.dist = Math.sqrt(bestD2);
    return best;
  }

  /** 점에서 가장 가까운 교차점 노드 id */
  nearestJunction(px, py) {
    const hit = this.nearest(px, py, 300);
    if (!hit) return null;
    const e = hit.edge;
    return hit.s < e.len / 2 ? e.a : e.b;
  }

  /** 엣지 위 거리 s(0..len) 의 좌표와 진행 방향 */
  pointAt(edge, s, dir = 1) {
    const p = edge.poly;
    const cum = edge.cum;
    const d = Math.max(0, Math.min(edge.len, s));
    let k = 1;
    while (k < cum.length - 1 && cum[k] < d) k++;
    const t = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    const ax = p[(k - 1) * 2];
    const ay = p[(k - 1) * 2 + 1];
    const bx = p[k * 2];
    const by = p[k * 2 + 1];
    let h = Math.atan2(by - ay, bx - ax);
    if (dir < 0) h += Math.PI;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, heading: h };
  }

  nodeXY(i) {
    return { x: this.nx[i], y: this.ny[i] };
  }

  /** 교차점에서 나갈 수 있는 (엣지, 방향) 목록 */
  outgoing(node) {
    return this.adj.get(node) || [];
  }

  /** dir 방향으로 진행할 때 도착하는 교차점 */
  endNode(edge, dir) {
    return dir > 0 ? edge.b : edge.a;
  }
  startNode(edge, dir) {
    return dir > 0 ? edge.a : edge.b;
  }
}

export async function loadGraph(url = './assets/graph.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`graph.json 로드 실패 (HTTP ${res.status})`);
  return new RoadGraph(await res.json());
}
