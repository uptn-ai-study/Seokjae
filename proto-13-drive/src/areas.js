/**
 * areas.js — 건물/공원/물/광장 폴리곤 로드 & 공간 인덱스
 *
 * t: 0=일반건물 1=주요건물 2=녹지 3=물 4=광장
 * p: [x0,y0,x1,y1,...] 월드 좌표(m) · c: 중심점 · n: 이름 · lv: 층수 · a: 면적(㎡)
 */

const CELL = 200;

export class AreaLayer {
  constructor(raw) {
    this.items = raw.areas.map((a, i) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let k = 0; k < a.p.length; k += 2) {
        if (a.p[k] < minX) minX = a.p[k];
        if (a.p[k] > maxX) maxX = a.p[k];
        if (a.p[k + 1] < minY) minY = a.p[k + 1];
        if (a.p[k + 1] > maxY) maxY = a.p[k + 1];
      }
      return { id: i, t: a.t, p: a.p, n: a.n || '', c: a.c, lv: a.lv || 0, area: a.a || 0, minX, minY, maxX, maxY };
    });

    this.grid = new Map();
    for (const it of this.items) {
      for (let cx = Math.floor(it.minX / CELL); cx <= Math.floor(it.maxX / CELL); cx++) {
        for (let cy = Math.floor(it.minY / CELL); cy <= Math.floor(it.maxY / CELL); cy++) {
          const k = `${cx},${cy}`;
          let l = this.grid.get(k);
          if (!l) this.grid.set(k, (l = []));
          l.push(it);
        }
      }
    }
  }

  /** 뷰포트와 겹치는 폴리곤 (t 오름차순 정렬 없이 원본 순서 = 큰 것부터) */
  queryRect(minX, minY, maxX, maxY, out = []) {
    out.length = 0;
    const seen = new Set();
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
        const l = this.grid.get(`${cx},${cy}`);
        if (!l) continue;
        for (const it of l) {
          if (seen.has(it.id)) continue;
          if (it.maxX < minX || it.minX > maxX || it.maxY < minY || it.minY > maxY) continue;
          seen.add(it.id);
          out.push(it);
        }
      }
    }
    return out;
  }
}

export async function loadAreas(url = './public/areas.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new AreaLayer(await res.json());
  } catch (e) {
    // 건물 데이터는 없어도 게임은 돌아간다
    console.warn('[areas] 로드 실패 — 건물 없이 진행합니다:', e.message);
    return null;
  }
}
