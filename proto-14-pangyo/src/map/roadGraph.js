/**
 * roadGraph.js — 도로 노드-엣지 그래프. NPC 주행과 경찰 A* 추격에 쓴다.
 * 타일맵과 분리되어 있어 도시를 넓혀도 노드만 추가하면 AI가 새 구역을 달린다.
 */
export class RoadGraph {
  constructor(graph, tileSize) {
    this.pos = graph.nodes.map(([tx, ty]) => [tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2]);
    this.n = this.pos.length;
    this.adj = Array.from({ length: this.n }, () => []);
    for (const [a, b, rank] of graph.edges) {
      const d = Math.hypot(this.pos[a][0] - this.pos[b][0], this.pos[a][1] - this.pos[b][1]);
      const cost = d / (rank === 2 ? 1.6 : 1);
      this.adj[a].push({ to: b, d, cost, rank });
      this.adj[b].push({ to: a, d, cost, rank });
    }

    // 공간 해시 — 가장 가까운 노드를 O(1)에 가깝게 찾는다
    this.cell = tileSize * 24;
    this.hash = new Map();
    for (let i = 0; i < this.n; i++) {
      const k = this._key(this.pos[i][0], this.pos[i][1]);
      let list = this.hash.get(k);
      if (!list) this.hash.set(k, (list = []));
      list.push(i);
    }

    this._came = new Int32Array(this.n);
    this._g = new Float64Array(this.n);
    this._seen = new Int32Array(this.n);
    this._epoch = 0;
  }

  _key(x, y) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }

  nearest(x, y) {
    let best = -1;
    let bestD = Infinity;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let r = 0; r < 4 && best < 0; r++) {
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          if (r > 0 && Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
          const list = this.hash.get(`${cx + i},${cy + j}`);
          if (!list) continue;
          for (const id of list) {
            const d = (this.pos[id][0] - x) ** 2 + (this.pos[id][1] - y) ** 2;
            if (d < bestD) { bestD = d; best = id; }
          }
        }
      }
    }
    return best;
  }

  /** 왔던 길로 되돌아가지 않게 다음 노드를 고른다 */
  nextFrom(node, prev, preferRank = 0) {
    const list = this.adj[node];
    if (!list.length) return prev;
    const opts = list.filter((e) => e.to !== prev);
    const pool = opts.length ? opts : list;
    if (preferRank) {
      const fast = pool.filter((e) => e.rank === 2);
      if (fast.length && Math.random() < 0.7) return fast[(Math.random() * fast.length) | 0].to;
    }
    return pool[(Math.random() * pool.length) | 0].to;
  }

  /** A* — 노드 인덱스 배열을 돌려준다(경로 없으면 빈 배열) */
  path(start, goal, limit = 4000) {
    if (start < 0 || goal < 0) return [];
    if (start === goal) return [start];
    const ep = ++this._epoch;
    const { _came: came, _g: g, _seen: seen } = this;
    const open = [{ i: start, f: 0 }];
    g[start] = 0;
    came[start] = -1;
    seen[start] = ep;
    let expanded = 0;
    const gx = this.pos[goal][0];
    const gy = this.pos[goal][1];

    while (open.length) {
      // 작은 그래프라 선형 최소 탐색으로 충분하다
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0].i;
      if (cur === goal) {
        const out = [];
        for (let n = goal; n !== -1; n = came[n]) out.push(n);
        return out.reverse();
      }
      if (++expanded > limit) break;
      for (const e of this.adj[cur]) {
        const ng = g[cur] + e.cost;
        if (seen[e.to] === ep && ng >= g[e.to]) continue;
        seen[e.to] = ep;
        g[e.to] = ng;
        came[e.to] = cur;
        const h = Math.hypot(this.pos[e.to][0] - gx, this.pos[e.to][1] - gy);
        open.push({ i: e.to, f: ng + h });
      }
    }
    return [];
  }
}
