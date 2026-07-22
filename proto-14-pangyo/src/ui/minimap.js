/**
 * minimap.js — 도시 전체를 1타일=1px 로 한 번만 구워두고(base canvas)
 * 매 프레임 필요한 부분만 잘라 그린다. 전체 지도(M)도 같은 이미지를 쓴다.
 */
const MINI = {
  '#': '#5b636e', x: '#69717c', '-': '#7d8691', g: '#3f6f3c',
  w: '#25567c', p: '#4a515b', z: '#9d9070', '.': '#343a42',
};

export class Minimap {
  constructor(map, canvas) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = map.w;
    this.base.height = map.h;
    this._bake();
    this.scale = 2.4;
  }

  _bake() {
    const c = this.base.getContext('2d');
    const m = this.map;
    const img = c.createImageData(m.w, m.h);
    const d = img.data;
    const cache = {};
    const rgb = (hex) => {
      if (cache[hex]) return cache[hex];
      const n = parseInt(hex.slice(1), 16);
      return (cache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    };
    for (let y = 0; y < m.h; y++) {
      const row = m.ground[y];
      for (let x = 0; x < m.w; x++) {
        const [r, g, b] = rgb(MINI[row[x]] || '#343a42');
        const i = (y * m.w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    // 건물 실루엣
    c.fillStyle = 'rgba(20,22,28,0.75)';
    for (const b of m.buildings) c.fillRect(b.x, b.y, b.w, b.h);
  }

  /** 우상단 미니맵 */
  draw(game) {
    const cv = this.canvas;
    const ctx = this.ctx;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = cv.clientWidth;
    if (cv.width !== size * dpr) {
      cv.width = cv.height = size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const ts = this.map.tileSize;
    const s = this.scale;
    const cx = game.player.x / ts;
    const cy = game.player.y / ts;
    const half = size / 2 / s;

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, 7);
    ctx.clip();
    ctx.fillStyle = '#11131a';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.base, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);

    const toMini = (wx, wy) => [size / 2 + (wx / ts - cx) * s, size / 2 + (wy / ts - cy) * s];

    // 미션 마커
    ctx.fillStyle = '#ffd23f';
    for (const mk of game.missions.markers) {
      const [x, y] = toMini(mk.x, mk.y);
      dot(ctx, x, y, 3.2);
    }
    // 목표 지점
    const wp = game.waypoint;
    if (wp) {
      const [x, y] = toMini(wp.x, wp.y);
      ctx.fillStyle = '#3ddc84';
      dot(ctx, x, y, 4);
    }
    // 경찰
    ctx.fillStyle = '#ff4d4d';
    for (const u of game.police.units) {
      const [x, y] = toMini(u.v.x, u.v.y);
      dot(ctx, x, y, 2.6);
    }
    // Wash Point
    ctx.fillStyle = '#4fc3f7';
    for (const h of game.hideouts) {
      const [x, y] = toMini(h.x, h.y);
      dot(ctx, x, y, 2.6);
    }
    // 플레이어
    const [px, py] = toMini(game.player.x, game.player.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.angle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, 7);
    ctx.stroke();
  }

  /** 전체 지도 오버레이 */
  drawFull(ctx, w, h, game) {
    const m = this.map;
    const s = Math.min(w / m.w, h / m.h) * 0.92;
    const ox = (w - m.w * s) / 2;
    const oy = (h - m.h * s) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.base, ox, oy, m.w * s, m.h * s);
    const ts = m.tileSize;
    const P = (wx, wy) => [ox + (wx / ts) * s, oy + (wy / ts) * s];

    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of m.districts) {
      const [bx, by, bw, bh] = d.bounds;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.strokeRect(ox + bx * s, oy + by * s, bw * s, bh * s);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(d.name, ox + (bx + bw / 2) * s, oy + (by + bh / 2) * s);
    }
    ctx.fillStyle = '#ffd23f';
    for (const mk of game.missions.markers) {
      const [x, y] = P(mk.x, mk.y);
      dot(ctx, x, y, 5);
      ctx.fillStyle = '#fff';
      ctx.fillText(mk.name, x, y - 9);
      ctx.fillStyle = '#ffd23f';
    }
    ctx.fillStyle = '#4fc3f7';
    for (const hp of game.hideouts) {
      const [x, y] = P(hp.x, hp.y);
      dot(ctx, x, y, 4);
    }
    ctx.fillStyle = '#ff4d4d';
    for (const u of game.police.units) {
      const [x, y] = P(u.v.x, u.v.y);
      dot(ctx, x, y, 3);
    }
    const [px, py] = P(game.player.x, game.player.y);
    ctx.fillStyle = '#fff';
    dot(ctx, px, py, 5);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, 7);
    ctx.stroke();
  }
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}
