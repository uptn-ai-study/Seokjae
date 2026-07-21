/**
 * render.js — Canvas 2D 레이어 렌더링
 *
 *  배경(블록) → 도로 케이싱 → 도로 노면 → 차선 → 추천 루트 → AI 차량 → 플레이어
 *
 * 도로는 월드 좌표(m) 그대로 그리고 카메라 변환(ctx.scale)이 픽셀로 바꿔준다.
 * lineWidth 를 미터로 지정할 수 있어 줌에 따라 도로 폭이 자연스럽게 변한다.
 */

const STYLE = {
  // 지면은 도로(흰색)보다 어둡게 — 도로가 지도에서 또렷하게 읽히도록
  bg: '#E9E9EF',
  block: '#E4E4EA',
  blockLine: '#DCDCE3',
  route: '#5F46FF',
  // 면 피처
  building: '#DDDDE6',
  buildingEdge: '#CBCBD7',
  buildingTop: '#EDEDF3',
  major: '#D0D0DD', // 주요 건물은 색상이 아니라 명도로만 구분 (루트 컬러와 혼동 방지)
  majorEdge: '#B7B7C8',
  green: '#D9EBD2',
  greenEdge: '#C8E0BE',
  water: '#C6E0F2',
  waterEdge: '#AFD2EA',
  square: '#E9E9EF',
  routeGlow: 'rgba(95,70,255,0.22)',
  centerLine: '#F0C64E',
  laneLine: '#FFFFFF',
};

// 도로 종류별 노면/테두리 색
const ROAD_STYLE = {
  motorway: { fill: '#FFE7C2', edge: '#E9C88E' },
  trunk: { fill: '#FFEACB', edge: '#EACE9A' },
  primary: { fill: '#FFF4DF', edge: '#E8D6B4' },
  secondary: { fill: '#FFFFFF', edge: '#CFD2DA' },
  tertiary: { fill: '#FFFFFF', edge: '#D3D6DE' },
  unclassified: { fill: '#FFFFFF', edge: '#D7DAE1' },
  residential: { fill: '#FFFFFF', edge: '#D7DAE1' },
  living_street: { fill: '#FAFAFC', edge: '#D9DCE3' },
};
const ORDER = ['living_street', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'];

export class Renderer {
  constructor(canvas, graph, areas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.g = graph;
    this.areas = areas || null;
    this._edgeBuf = [];
    this._vehBuf = [];
    this._areaBuf = [];
    this.minimap = null;
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  draw(cam, player, traffic, route, dest, opts = {}) {
    const ctx = this.ctx;
    const rect = cam.viewRect(150);

    // 0. 배경
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = STYLE.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    cam.applyTransform(ctx);
    if (this.areas) this._drawAreas(ctx, rect, cam);
    else this._drawBlocks(ctx, rect, cam);

    const edges = this.g.queryRect(rect.minX, rect.minY, rect.maxX, rect.maxY, this._edgeBuf);

    // 1. 케이싱 (아래 → 위 순서로 작은 도로부터)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cls of ORDER) {
      this._strokeClass(ctx, edges, cls, ROAD_STYLE[cls].edge, 2.4);
    }
    // 2. 노면
    for (const cls of ORDER) {
      this._strokeClass(ctx, edges, cls, ROAD_STYLE[cls].fill, 0);
    }
    // 3. 차선/중앙선 (줌이 충분할 때만)
    if (cam.zoom > 2.0) this._drawLaneMarks(ctx, edges, cam);
    // 3-1. 주요 건물/공원 이름
    if (this.areas && cam.zoom >= 2.6) this._drawAreaLabels(ctx, cam);

    // 4. 추천 루트
    if (route && route.polyline.length >= 4) this._drawRoute(ctx, route, cam);
    if (dest) this._drawDest(ctx, dest, cam);

    // 5. AI 차량
    const vs = traffic.visible(rect, this._vehBuf);
    for (const v of vs) this._drawCar(ctx, v.x, v.y, v.heading, v.len, v.width, v.color, false);

    // 6. 플레이어 — 줌아웃 상태에서 놓치지 않도록 헤일로를 덧그린다(가까이서는 불필요)
    if (cam.zoom < 4.5) {
      const halo = Math.max(player.length * 0.9, 16 / cam.zoom);
      ctx.beginPath();
      ctx.arc(player.x, player.y, halo, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(95,70,255,0.13)';
      ctx.fill();
      ctx.lineWidth = 1.2 / cam.zoom;
      ctx.strokeStyle = 'rgba(95,70,255,0.55)';
      ctx.stroke();
    }
    this._drawCar(ctx, player.x, player.y, player.heading, player.length, player.width, '#5F46FF', true, player.bumpTimer > 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts.minimap !== false) this._drawMinimap(ctx, cam, player, dest, route);
  }

  _strokeClass(ctx, edges, cls, color, extra) {
    ctx.beginPath();
    let any = false;
    let width = 0;
    for (const e of edges) {
      if (e.cls !== cls) continue;
      any = true;
      width = e.width;
      const p = e.poly;
      ctx.moveTo(p[0], p[1]);
      for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
    }
    if (!any) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width + extra;
    ctx.stroke();
  }

  _drawLaneMarks(ctx, edges, cam) {
    // 중앙선 (양방향 + 폭 10m 이상)
    ctx.beginPath();
    let any = false;
    for (const e of edges) {
      if (e.oneway || e.width < 10) continue;
      any = true;
      const p = e.poly;
      ctx.moveTo(p[0], p[1]);
      for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
    }
    if (any) {
      ctx.strokeStyle = STYLE.centerLine;
      ctx.lineWidth = 0.32;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    // 차로 구분 파선
    ctx.beginPath();
    any = false;
    for (const e of edges) {
      if (e.width < 12) continue;
      any = true;
      const p = e.poly;
      ctx.moveTo(p[0], p[1]);
      for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
    }
    if (any) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.22;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** 물 → 녹지/광장 → 건물 순으로 채운다. 큰 것부터 정렬되어 있어 작은 건물이 묻히지 않는다. */
  _drawAreas(ctx, rect, cam) {
    const items = this.areas.queryRect(rect.minX, rect.minY, rect.maxX, rect.maxY, this._areaBuf);
    // 아주 줌아웃한 상태에선 작은 건물을 생략해 부하와 시각 노이즈를 줄인다
    const minArea = cam.zoom < 1.8 ? 500 : cam.zoom < 2.6 ? 220 : 0;

    const pass = (types, fill, edge, skipSmall) => {
      ctx.beginPath();
      let any = false;
      for (const it of items) {
        if (!types.includes(it.t)) continue;
        if (skipSmall && it.area && it.area < minArea) continue;
        if (skipSmall && !it.area && minArea > 220) continue; // 면적 미기록 = 소형 건물
        any = true;
        ctx.moveTo(it.p[0], it.p[1]);
        for (let k = 2; k < it.p.length; k += 2) ctx.lineTo(it.p[k], it.p[k + 1]);
        ctx.closePath();
      }
      if (!any) return;
      ctx.fillStyle = fill;
      ctx.fill();
      if (edge && cam.zoom > 1.6) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = 0.9 / cam.zoom;
        ctx.stroke();
      }
    };

    pass([3], STYLE.water, STYLE.waterEdge, false);
    pass([2], STYLE.green, STYLE.greenEdge, false);
    pass([4], STYLE.square, null, false);
    pass([0], STYLE.building, STYLE.buildingEdge, true);
    pass([1], STYLE.major, STYLE.majorEdge, false);
  }

  /** 주요 건물·공원 이름 (겹침은 간단한 사각 충돌로 걸러냄) */
  _drawAreaLabels(ctx, cam) {
    const items = this._areaBuf;
    const px = 1 / cam.zoom; // 1픽셀에 해당하는 미터
    const size = 12 * px;
    const minArea = cam.zoom >= 5 ? 600 : cam.zoom >= 3.6 ? 1500 : 3000;
    ctx.font = `600 ${size}px 'SUIT Variable', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const placed = [];
    let drawn = 0;
    for (const it of items) {
      if (drawn >= 26) break;
      if (!it.n || !it.c) continue;
      if (it.t !== 1 && it.t !== 2 && it.t !== 4) continue;
      if (it.area < minArea) continue;
      const w = ctx.measureText(it.n).width;
      const box = { x0: it.c[0] - w / 2, x1: it.c[0] + w / 2, y0: it.c[1] - size, y1: it.c[1] + size };
      if (placed.some((b) => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1))) continue;
      placed.push(box);
      drawn++;
      ctx.lineWidth = 3 * px;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(it.n, it.c[0], it.c[1]);
      ctx.fillStyle = it.t === 2 ? '#4B7C4A' : '#4B5563';
      ctx.fillText(it.n, it.c[0], it.c[1]);
    }
  }

  _drawBlocks(ctx, rect, cam) {
    // 도로 사이 "블록"을 암시하는 아주 옅은 격자 (지도 느낌 보조)
    const step = 100;
    ctx.fillStyle = STYLE.block;
    const x0 = Math.floor(rect.minX / step) * step;
    const y0 = Math.floor(rect.minY / step) * step;
    ctx.beginPath();
    for (let x = x0; x < rect.maxX; x += step) {
      for (let y = y0; y < rect.maxY; y += step) {
        ctx.rect(x + 6, y + 6, step - 12, step - 12);
      }
    }
    ctx.fill();
  }

  _drawRoute(ctx, route, cam) {
    const p = route.polyline;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STYLE.routeGlow;
    ctx.lineWidth = 11;
    ctx.stroke();
    ctx.strokeStyle = STYLE.route;
    ctx.lineWidth = 4.2;
    ctx.stroke();
  }

  _drawDest(ctx, dest, cam) {
    const r = 9 / cam.zoom + 3;
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(95,70,255,0.18)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = STYLE.route;
    ctx.fill();
    ctx.lineWidth = 1.2 / cam.zoom;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  _drawCar(ctx, x, y, heading, len, width, color, isPlayer, bumped) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    this._roundRect(ctx, -len / 2 + 0.25, -width / 2 + 0.35, len, width, 0.55);
    ctx.fill();
    // 바퀴 (줌인했을 때만 보이는 디테일)
    ctx.fillStyle = '#2B2F36';
    for (const sx of [-len * 0.29, len * 0.29]) {
      for (const sy of [-width / 2 - 0.16, width / 2 - 0.12]) ctx.fillRect(sx - 0.34, sy, 0.68, 0.28);
    }
    // 차체
    ctx.fillStyle = bumped ? '#EF4444' : color;
    this._roundRect(ctx, -len / 2, -width / 2, len, width, 0.55);
    ctx.fill();
    // 앞유리
    ctx.fillStyle = 'rgba(17,24,39,0.32)';
    this._roundRect(ctx, len * 0.05, -width / 2 + 0.22, len * 0.28, width - 0.44, 0.2);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.22;
      this._roundRect(ctx, -len / 2, -width / 2, len, width, 0.55);
      ctx.stroke();
      // 진행 방향 표시
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(len / 2 - 0.1, 0);
      ctx.lineTo(len / 2 - 0.75, -0.42);
      ctx.lineTo(len / 2 - 0.75, 0.42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 미니맵 ----------
  _buildMinimap(size) {
    const b = this.g.bounds;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const scale = size / Math.max(w, h);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillRect(0, 0, cv.width, cv.height);
    c.translate(-b.minX * scale, -b.minY * scale);
    c.scale(scale, scale);
    // 방향 감각을 돕는 녹지/물
    if (this.areas) {
      for (const t of [3, 2]) {
        c.beginPath();
        let any = false;
        for (const it of this.areas.items) {
          if (it.t !== t || it.area < 1200) continue;
          any = true;
          c.moveTo(it.p[0], it.p[1]);
          for (let k = 2; k < it.p.length; k += 2) c.lineTo(it.p[k], it.p[k + 1]);
          c.closePath();
        }
        if (any) {
          c.fillStyle = t === 3 ? STYLE.water : STYLE.green;
          c.fill();
        }
      }
    }
    c.lineCap = 'round';
    for (const e of this.g.edges) {
      c.beginPath();
      const p = e.poly;
      c.moveTo(p[0], p[1]);
      for (let k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]);
      c.strokeStyle = e.rank <= 2 ? '#9CA3AF' : '#D9DBE1';
      c.lineWidth = e.rank <= 2 ? 9 : 5;
      c.stroke();
    }
    this.minimap = { cv, scale, b };
  }

  _drawMinimap(ctx, cam, player, dest, route) {
    if (!this.minimap) this._buildMinimap(1400);
    const m = this.minimap;
    const dpr = cam.dpr;
    const size = Math.min(132, Math.max(96, cam.w * 0.17));
    const pad = 12;
    const x = (cam.w - size - pad) * dpr;
    const y = pad * dpr;
    const s = size * dpr;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, s, s);
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, s, s);

    // 플레이어 중심으로 미니맵을 이동 (400m 반경)
    const spanM = 900;
    const k = s / (spanM * m.scale);
    ctx.translate(x + s / 2, y + s / 2);
    ctx.scale(k, k);
    ctx.translate(-(player.x - m.b.minX) * m.scale, -(player.y - m.b.minY) * m.scale);
    ctx.drawImage(m.cv, 0, 0);

    if (route && route.polyline.length >= 4) {
      const p = route.polyline;
      ctx.beginPath();
      ctx.moveTo((p[0] - m.b.minX) * m.scale, (p[1] - m.b.minY) * m.scale);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo((p[i] - m.b.minX) * m.scale, (p[i + 1] - m.b.minY) * m.scale);
      ctx.strokeStyle = '#5F46FF';
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    if (dest) {
      ctx.beginPath();
      ctx.arc((dest.x - m.b.minX) * m.scale, (dest.y - m.b.minY) * m.scale, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#5F46FF';
      ctx.fill();
    }
    ctx.restore();

    // 플레이어 아이콘 & 테두리
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.rotate(player.heading);
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(6 * dpr, 0);
    ctx.lineTo(-4 * dpr, -4 * dpr);
    ctx.lineTo(-4 * dpr, 4 * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
}
