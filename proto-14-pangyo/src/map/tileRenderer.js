/**
 * tileRenderer.js — 지면 타일과 건물 지붕을 그린다.
 * 카메라 밖은 전부 스킵(뷰포트 컬링)하고, 건물은 청크 색인으로만 훑는다.
 */

const GROUND = {
  '#': '#3b4048', // 아스팔트
  x: '#454b54', // 횡단보도 바탕
  '-': '#8f98a3', // 인도
  g: '#4f8f4a', // 잔디/공원
  w: '#2b6c9c', // 물
  p: '#575e69', // 주차장
  z: '#bfae8c', // 광장
  '.': '#6d727a', // 빈 대지
};

// 지붕 팔레트: 0 오피스 / 1 상업 / 2 주거 / 3 교외
const ROOFS = [
  ['#4a5b74', '#54688a', '#3f5068', '#5d7396'],
  ['#8a5573', '#a4627f', '#7a4c68', '#b06f88'],
  ['#8c6b4f', '#a07a58', '#7b5e46', '#b08a63'],
  ['#6e7a5a', '#7c8a64', '#616d50', '#8a976f'],
];

/** hex 색을 밝게(+)/어둡게(-) */
const _shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  const hit = _shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  const out = `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  _shadeCache.set(key, out);
  return out;
}

export class TileRenderer {
  constructor(map) {
    this.map = map;
    this.ts = map.tileSize;
    this.spacing = map.meta.streetSpacing || 12;
    this.avenueEvery = map.meta.avenueEvery || 4;
    this.night = 0; // 0 = 낮, 1 = 밤
  }

  draw(ctx, cam) {
    const ts = this.ts;
    const m = this.map;
    const b = cam.bounds(ts * 2);
    const tx0 = Math.max(0, (b.x0 / ts) | 0);
    const ty0 = Math.max(0, (b.y0 / ts) | 0);
    const tx1 = Math.min(m.w - 1, (b.x1 / ts) | 0);
    const ty1 = Math.min(m.h - 1, (b.y1 / ts) | 0);

    // 1) 지면
    for (let ty = ty0; ty <= ty1; ty++) {
      const row = m.ground[ty];
      let runStart = tx0;
      let runChar = row[tx0];
      for (let tx = tx0 + 1; tx <= tx1 + 1; tx++) {
        const c = tx <= tx1 ? row[tx] : null;
        if (c !== runChar) {
          ctx.fillStyle = GROUND[runChar] || '#555';
          ctx.fillRect(runStart * ts, ty * ts, (tx - runStart) * ts, ts);
          runStart = tx;
          runChar = c;
        }
      }
    }

    // 2) 도로 마킹 (차선 + 횡단보도)
    this._markings(ctx, tx0, ty0, tx1, ty1);

    // 3) 소품(가로수) → 건물
    this._props(ctx, b);
    this._buildings(ctx, cam, b);
  }

  _props(ctx, b) {
    const m = this.map;
    const cpx = m.chunkTiles * this.ts;
    const c0 = Math.max(0, Math.floor(b.x0 / cpx));
    const c1 = Math.min(m.chunkCols - 1, Math.floor(b.x1 / cpx));
    const r0 = Math.max(0, Math.floor(b.y0 / cpx));
    const r1 = Math.min(m.chunkRows - 1, Math.floor(b.y1 / cpx));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = m.propsByChunk.get(r * m.chunkCols + c);
        if (!list) continue;
        for (const p of list) {
          if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
          ctx.fillStyle = 'rgba(10,14,10,0.28)';
          ctx.beginPath();
          ctx.arc(p.x + p.r * 0.35, p.y + p.r * 0.45, p.r, 0, 7);
          ctx.fill();
          ctx.fillStyle = p.k === 1 ? '#3f7a44' : '#2f6b39';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 7);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.45, 0, 7);
          ctx.fill();
        }
      }
    }
  }

  /**
   * 차선/횡단보도. 타일 단위로 그려서 다리 밖(강 위)에는 선이 그려지지 않는다.
   */
  _markings(ctx, tx0, ty0, tx1, ty1) {
    const ts = this.ts;
    const S = this.spacing;
    const m = this.map;
    const lane = 'rgba(240,222,120,0.5)';
    const cross = 'rgba(238,240,245,0.75)';
    for (let ty = ty0; ty <= ty1; ty++) {
      const row = m.ground[ty];
      const onLaneY = ty % S === 0;
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = row[tx];
        if (t === 'x') {
          ctx.fillStyle = cross;
          const horiz = row[tx - 1] === 'x' || row[tx + 1] === 'x';
          for (let i = 0; i < 4; i++) {
            if (horiz) ctx.fillRect(tx * ts + 2, ty * ts + i * 8 + 2, ts - 4, 4);
            else ctx.fillRect(tx * ts + i * 8 + 2, ty * ts + 2, 4, ts - 4);
          }
          continue;
        }
        if (t !== '#') continue;
        ctx.fillStyle = lane;
        if (tx % S === 0) {
          ctx.fillRect(tx * ts - 1, ty * ts + 3, 2, 11);
          ctx.fillRect(tx * ts - 1, ty * ts + 19, 2, 11);
        }
        if (onLaneY) {
          ctx.fillRect(tx * ts + 3, ty * ts - 1, 11, 2);
          ctx.fillRect(tx * ts + 19, ty * ts - 1, 11, 2);
        }
      }
    }
  }

  _buildings(ctx, cam, b) {
    const m = this.map;
    const ts = this.ts;
    const cs = m.chunkTiles;
    const c0 = Math.max(0, Math.floor(b.x0 / ts / cs));
    const c1 = Math.min(m.chunkCols - 1, Math.floor(b.x1 / ts / cs));
    const r0 = Math.max(0, Math.floor(b.y0 / ts / cs));
    const r1 = Math.min(m.chunkRows - 1, Math.floor(b.y1 / ts / cs));
    const seen = new Set();

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = m.buildingsByChunk.get(r * m.chunkCols + c);
        if (!list) continue;
        for (const bld of list) {
          if (seen.has(bld)) continue;
          seen.add(bld);
          const x = bld.x * ts;
          const y = bld.y * ts;
          const w = bld.w * ts;
          const h = bld.h * ts;
          if (x > b.x1 || y > b.y1 || x + w < b.x0 || y + h < b.y0) continue;
          const ext = bld.z * 3.2;
          const roof = ROOFS[bld.p][bld.v];

          // 바닥 그림자
          ctx.fillStyle = 'rgba(8,10,16,0.32)';
          ctx.fillRect(x + ext * 0.35, y + ext * 0.35, w + ext * 0.8, h + ext * 0.8);

          // 벽면(오른쪽·아래) — 지붕보다 어둡게 깔아 높이감을 만든다
          ctx.fillStyle = shade(roof, -0.45);
          ctx.beginPath();
          ctx.moveTo(x + w, y);
          ctx.lineTo(x + w + ext, y + ext);
          ctx.lineTo(x + w + ext, y + h + ext);
          ctx.lineTo(x + ext, y + h + ext);
          ctx.lineTo(x, y + h);
          ctx.lineTo(x + w, y + h);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = shade(roof, -0.62);
          ctx.fillRect(x + ext * 0.2, y + h, w, ext * 0.8);

          // 지붕
          ctx.fillStyle = roof;
          ctx.fillRect(x, y, w, h);

          // 지붕 디테일 — 테두리 + 옥상 설비
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
          if (w > 60 && h > 60) {
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            ctx.fillRect(x + w * 0.22, y + h * 0.22, w * 0.26, h * 0.2);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + w * 0.58, y + h * 0.6, w * 0.22, h * 0.18);
          }
          if (bld.landmark) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 15px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(bld.landmark, x + w / 2, y + h / 2);
          }
          // 밤에는 창문 불빛
          if (this.night > 0.3 && bld.z > 2) {
            ctx.fillStyle = `rgba(255,214,120,${0.16 * this.night})`;
            ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
          }
        }
      }
    }
  }
}
