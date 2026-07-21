/**
 * geo.js — 좌표계 변환
 *
 *  WGS84(위경도) ─ project ─▶ 월드 좌표(미터, 중심 기준 로컬 평면)
 *  월드 좌표      ─ camera ─▶ 화면 픽셀
 *
 * 투영은 대상 지역이 좁으므로(반경 2km) equirectangular 근사를 쓴다.
 * 전처리 스크립트(build-graph.js)와 동일한 식을 사용해야 한다.
 * 월드 y축은 화면과 맞추기 위해 남쪽이 + 방향이다.
 */

const R = 6378137; // 지구 반경 (m)
const D2R = Math.PI / 180;

export function createProjection(center) {
  const kx = Math.cos(center.lat * D2R) * R * D2R; // 경도 1도당 m
  const ky = R * D2R; // 위도 1도당 m
  return {
    center,
    /** 위경도 → 월드(m) */
    toWorld(lon, lat) {
      return { x: (lon - center.lon) * kx, y: -(lat - center.lat) * ky };
    },
    /** 월드(m) → 위경도 */
    toLngLat(x, y) {
      return { lon: center.lon + x / kx, lat: center.lat - y / ky };
    },
  };
}

/** Web Mercator (지도 타일을 얹고 싶을 때를 위한 보조 유틸) */
export function mercator(lon, lat) {
  const x = R * lon * D2R;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));
  return { x, y: -y };
}

// ---------- 기하 유틸 ----------

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** 각도를 -PI..PI 로 정규화 */
export function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** 각도 보간 (최단 회전) */
export function lerpAngle(a, b, t) {
  return a + normAngle(b - a) * t;
}

/**
 * 선분 위에서 점 p 에 가장 가까운 지점.
 * @returns {{x:number,y:number,t:number,d2:number}} t=0..1, d2=거리제곱
 */
export function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t;
  const y = ay + dy * t;
  return { x, y, t, d2: (px - x) ** 2 + (py - y) ** 2 };
}
