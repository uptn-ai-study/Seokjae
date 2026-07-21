/**
 * pathfinding.js — 도로 그래프 A* 경로 탐색
 *
 * 비용은 "예상 주행 시간"(거리 / 제한속도). 휴리스틱은 직선거리 / 최고속도라
 * 항상 실제 비용 이하 → admissible.
 */

const KMH = 1 / 3.6;
const MAX_SPEED = 90 * KMH; // m/s — 휴리스틱 상한

/** 아주 단순한 이진 힙 (우선순위 큐) */
class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * @param {RoadGraph} g
 * @param {number} startNode 교차점 노드 id
 * @param {number} goalNode
 * @returns {{nodes:number[], steps:{edge,dir}[], polyline:number[], length:number, time:number}|null}
 */
export function findRoute(g, startNode, goalNode) {
  if (startNode == null || goalNode == null) return null;
  if (startNode === goalNode) return { nodes: [startNode], steps: [], polyline: [], length: 0, time: 0 };

  const gx = g.nx[goalNode];
  const gy = g.ny[goalNode];
  const h = (n) => Math.hypot(g.nx[n] - gx, g.ny[n] - gy) / MAX_SPEED;

  const gScore = new Map([[startNode, 0]]);
  const cameFrom = new Map();
  const closed = new Set();
  const open = new MinHeap();
  open.push({ n: startNode, f: h(startNode) });

  let found = false;
  let guard = 0;
  while (open.size && guard++ < 400000) {
    const cur = open.pop();
    if (closed.has(cur.n)) continue;
    if (cur.n === goalNode) {
      found = true;
      break;
    }
    closed.add(cur.n);
    const base = gScore.get(cur.n);
    for (const { edge, dir } of g.outgoing(cur.n)) {
      const to = g.endNode(edge, dir);
      if (closed.has(to)) continue;
      const cost = edge.len / (edge.speed * KMH);
      const tentative = base + cost;
      if (tentative < (gScore.get(to) ?? Infinity)) {
        gScore.set(to, tentative);
        cameFrom.set(to, { from: cur.n, edge, dir });
        open.push({ n: to, f: tentative + h(to) });
      }
    }
  }
  if (!found) return null;

  // 역추적
  const steps = [];
  const nodes = [goalNode];
  let cur = goalNode;
  while (cur !== startNode) {
    const c = cameFrom.get(cur);
    if (!c) return null;
    steps.push({ edge: c.edge, dir: c.dir });
    nodes.push(c.from);
    cur = c.from;
  }
  steps.reverse();
  nodes.reverse();

  // 폴리라인 생성
  const polyline = [];
  let length = 0;
  for (const { edge, dir } of steps) {
    const p = edge.poly;
    const pts = [];
    for (let k = 0; k < p.length; k += 2) pts.push([p[k], p[k + 1]]);
    if (dir < 0) pts.reverse();
    for (let i = 0; i < pts.length; i++) {
      if (polyline.length && i === 0) continue; // 이음새 중복 제거
      polyline.push(pts[i][0], pts[i][1]);
    }
    length += edge.len;
  }

  return { nodes, steps, polyline, length, time: gScore.get(goalNode) };
}

/** 폴리라인에서 점까지의 최단 거리 (오프루트 판정용) */
export function distanceToPolyline(poly, px, py) {
  let best = Infinity;
  for (let k = 0; k + 3 < poly.length; k += 2) {
    const ax = poly[k];
    const ay = poly[k + 1];
    const bx = poly[k + 2];
    const by = poly[k + 3];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = (px - ax - dx * t) ** 2 + (py - ay - dy * t) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
