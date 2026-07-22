/**
 * camera.js — 대상 추적 + 속도에 따른 look-ahead + 부드러운 감쇠.
 */
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.shake = 0;
    this.viewW = 1;
    this.viewH = 1;
  }

  resize(w, h, dpr) {
    this.viewW = w;
    this.viewH = h;
    this.dpr = dpr;
  }

  /** target: {x,y,vx,vy} */
  follow(target, dt, opts = {}) {
    const lead = opts.lead ?? 0.55;
    const ax = target.x + (target.vx || 0) * lead;
    const ay = target.y + (target.vy || 0) * lead;
    const k = Math.min(1, (opts.stiff ?? 5) * dt);
    this.x += (ax - this.x) * k;
    this.y += (ay - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 3 * dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  snap(x, y) {
    this.x = x;
    this.y = y;
  }

  /** 캔버스 좌표계를 월드 기준으로 옮긴다 */
  apply(ctx) {
    const s = this.shake;
    const sx = s ? (Math.random() - 0.5) * s * 14 : 0;
    const sy = s ? (Math.random() - 0.5) * s * 14 : 0;
    ctx.translate(this.viewW / 2 + sx, this.viewH / 2 + sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** 화면에 보이는 월드 사각형 (컬링용, 여유 margin 포함) */
  bounds(margin = 96) {
    const hw = this.viewW / 2 / this.zoom + margin;
    const hh = this.viewH / 2 / this.zoom + margin;
    return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
  }
}
