/**
 * camera.js — 월드(m) ↔ 화면(px) 변환 + 플레이어 추적
 *
 * zoom = 1미터당 픽셀 수. 화면 중앙이 카메라 위치.
 */
import { clamp, lerp } from './geo.js';

// 1미터당 픽셀 수. 1.2 ≈ 도심 한 눈에, 16 ≈ 차량 바로 위에서 들여다보기
export const ZOOM_LEVELS = [1.2, 1.8, 2.6, 3.6, 5.0, 7.0, 10.0, 14.0, 19.0];

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoomIndex = 2;
    this.zoom = ZOOM_LEVELS[this.zoomIndex];
    this.targetZoom = this.zoom;
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  setZoomIndex(i) {
    this.zoomIndex = clamp(i, 0, ZOOM_LEVELS.length - 1);
    this.targetZoom = ZOOM_LEVELS[this.zoomIndex];
  }
  zoomIn() {
    this.setZoomIndex(this.zoomIndex + 1);
  }
  zoomOut() {
    this.setZoomIndex(this.zoomIndex - 1);
  }

  /** 플레이어를 부드럽게 따라간다. 속도가 빠를수록 진행 방향을 조금 더 앞서 본다. */
  follow(target, dt) {
    // 진행 방향을 살짝 앞서 본다. 줌인 상태에선 화면 밖으로 나가지 않도록 픽셀 기준으로 제한.
    const maxLeadPx = Math.min(this.w, this.h) * 0.22;
    const lead = Math.min(48, maxLeadPx / this.zoom, Math.abs(target.speed) * 0.75);
    const tx = target.x + Math.cos(target.heading) * lead;
    const ty = target.y + Math.sin(target.heading) * lead;
    const k = 1 - Math.pow(0.0015, dt); // 프레임레이트 독립 lerp
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, k);
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.pow(0.005, dt));
  }

  snapTo(target) {
    this.x = target.x;
    this.y = target.y;
  }

  toScreen(wx, wy) {
    return { x: (wx - this.x) * this.zoom + this.w / 2, y: (wy - this.y) * this.zoom + this.h / 2 };
  }

  toWorld(sx, sy) {
    return { x: (sx - this.w / 2) / this.zoom + this.x, y: (sy - this.h / 2) / this.zoom + this.y };
  }

  /** 컬링용 뷰포트 사각형 (월드 좌표, margin 미터만큼 여유) */
  viewRect(margin = 120) {
    const hw = this.w / 2 / this.zoom + margin;
    const hh = this.h / 2 / this.zoom + margin;
    return { minX: this.x - hw, minY: this.y - hh, maxX: this.x + hw, maxY: this.y + hh };
  }

  /** ctx에 월드→화면 변환을 적용 (이후 월드 좌표로 그리면 됨) */
  applyTransform(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
}
