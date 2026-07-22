/**
 * mapLoader.js — city.json 을 읽어 게임이 쓰는 형태로 만든다.
 * 하드코딩된 지형은 하나도 없다. 데이터 파일만 바꾸면 도시가 바뀐다.
 */

export const SOLID = 1; // 통행 불가(건물)
export const WATER = 2; // 물
export const FREE = 0;

export class CityMap {
  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`city 데이터를 불러오지 못했습니다: ${res.status}`);
    return new CityMap(await res.json());
  }

  constructor(json) {
    this.raw = json;
    const m = json.meta;
    this.tileSize = m.tileSize;
    this.w = m.width;
    this.h = m.height;
    this.meta = m;
    this.pxW = this.w * this.tileSize;
    this.pxH = this.h * this.tileSize;
    this.codes = m.tileCodes;

    const layer = (n) => json.layers.find((l) => l.name === n);
    this.ground = layer('ground').data; // 문자열 배열
    this.buildings = layer('buildings').data;
    this.props = layer('props')?.data || [];
    this.graph = layer('roads').data;
    this.districts = json.districts;
    this.landmarks = json.landmarks || [];
    this.spawns = json.spawns;

    this._buildCollision();
    this._indexBuildings();
  }

  /** collision 레이어는 데이터 중복을 피해 ground+buildings 에서 파생시킨다 */
  _buildCollision() {
    const { w, h } = this;
    const grid = new Uint8Array(w * h);
    const W = this.codes.WATER;
    for (let y = 0; y < h; y++) {
      const row = this.ground[y];
      for (let x = 0; x < w; x++) if (row[x] === W) grid[y * w + x] = WATER;
    }
    for (const b of this.buildings) {
      for (let y = b.y; y < b.y + b.h; y++) {
        if (y < 0 || y >= h) continue;
        for (let x = b.x; x < b.x + b.w; x++) {
          if (x < 0 || x >= w) continue;
          grid[y * w + x] = SOLID;
        }
      }
    }
    this.collision = grid;
  }

  /** 건물을 청크별로 색인해 렌더 시 훑는 양을 줄인다 */
  _indexBuildings() {
    this.chunkTiles = 32;
    this.chunkCols = Math.ceil(this.w / this.chunkTiles);
    this.chunkRows = Math.ceil(this.h / this.chunkTiles);
    this.buildingsByChunk = new Map();
    for (const b of this.buildings) {
      const c0 = Math.floor(b.x / this.chunkTiles);
      const c1 = Math.floor((b.x + b.w) / this.chunkTiles);
      const r0 = Math.floor(b.y / this.chunkTiles);
      const r1 = Math.floor((b.y + b.h) / this.chunkTiles);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const k = r * this.chunkCols + c;
          let list = this.buildingsByChunk.get(k);
          if (!list) this.buildingsByChunk.set(k, (list = []));
          list.push(b);
        }
      }
    }

    this.propsByChunk = new Map();
    const cpx = this.chunkTiles * this.tileSize;
    for (const p of this.props) {
      const k = Math.floor(p.y / cpx) * this.chunkCols + Math.floor(p.x / cpx);
      let list = this.propsByChunk.get(k);
      if (!list) this.propsByChunk.set(k, (list = []));
      list.push(p);
    }
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return this.codes.WATER;
    return this.ground[ty][tx];
  }

  /** 월드 좌표 기준 통행 판정 */
  solidAtPx(x, y) {
    const tx = (x / this.tileSize) | 0;
    const ty = (y / this.tileSize) | 0;
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return SOLID;
    return this.collision[ty * this.w + tx];
  }

  isRoadPx(x, y) {
    const t = this.tileAt((x / this.tileSize) | 0, (y / this.tileSize) | 0);
    return t === this.codes.ROAD || t === this.codes.CROSS;
  }

  isWalkPx(x, y) {
    const t = this.tileAt((x / this.tileSize) | 0, (y / this.tileSize) | 0);
    return t === this.codes.WALK || t === this.codes.CROSS || t === this.codes.PLAZA;
  }

  districtAtPx(x, y) {
    const tx = x / this.tileSize;
    const ty = y / this.tileSize;
    for (const d of this.districts) {
      const [bx, by, bw, bh] = d.bounds;
      if (tx >= bx && tx < bx + bw && ty >= by && ty < by + bh) return d;
    }
    return { id: 'outskirts', name: 'Outskirts', theme: 'suburb' };
  }

  clampX(x) { return Math.max(8, Math.min(this.pxW - 8, x)); }
  clampY(y) { return Math.max(8, Math.min(this.pxH - 8, y)); }
}
