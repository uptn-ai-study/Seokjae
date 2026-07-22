/**
 * mission.js — 데이터 주도 미션. assets/data/missions/*.json 만 추가하면
 * 코드 수정 없이 새 미션이 생긴다.
 *
 * 좌표는 타일 단위로 쓰고, snap:"road" 면 가장 가까운 도로 노드로 보정한다.
 * (에디터 없이 손으로 좌표를 찍어도 건물 안에 목표가 박히지 않도록)
 */

export class Missions {
  constructor(game) {
    this.game = game;
    this.defs = [];
    this.active = null;
    this.completed = new Set();
    this.markers = [];
  }

  async load(indexUrl) {
    const base = indexUrl.replace(/[^/]+$/, '');
    const list = await (await fetch(indexUrl)).json();
    this.defs = await Promise.all(list.map(async (f) => (await fetch(base + f)).json()));
    this._prepare();
  }

  _prepare() {
    const ts = this.game.map.tileSize;
    const snap = (pos, mode) => {
      let x = pos[0] * ts;
      let y = pos[1] * ts;
      if (mode !== 'none') {
        const n = this.game.graph.nearest(x, y);
        if (n >= 0) [x, y] = this.game.graph.pos[n];
      }
      return [x, y];
    };
    for (const d of this.defs) {
      d._trigger = snap(d.trigger.pos, d.trigger.snap || 'road');
      d._radius = (d.trigger.radius || 3) * ts;
      for (const o of d.objectives) {
        if (o.pos) o._pos = snap(o.pos, o.snap || 'road');
        o._radius = (o.radius || 3) * ts;
      }
    }
    this.refreshMarkers();
  }

  refreshMarkers() {
    this.markers = this.defs
      .filter((d) => d.repeatable || !this.completed.has(d.id))
      .map((d) => ({ id: d.id, name: d.name, x: d._trigger[0], y: d._trigger[1], r: d._radius }));
  }

  get objective() {
    if (!this.active) return null;
    const o = this.active.def.objectives[this.active.idx];
    return { text: o.text || DEFAULT_TEXT[o.type] || '진행 중', timer: this.active.timer, o };
  }

  /** 현재 목표 지점(내비 화살표/미니맵용) */
  get waypoint() {
    if (!this.active) return null;
    const o = this.active.def.objectives[this.active.idx];
    return o._pos ? { x: o._pos[0], y: o._pos[1] } : null;
  }

  start(def) {
    this.active = { def, idx: 0, timer: null, elapsed: 0 };
    this._enterObjective();
    this.game.toast(`미션 시작 — ${def.name}`, 'good');
    this.game.audio.pickup();
  }

  _enterObjective() {
    const a = this.active;
    const o = a.def.objectives[a.idx];
    a.timer = o.timeLimit ?? null;
    a.hold = 0;
    if (o.grantStars) this.game.wanted.add(o.grantStars);
  }

  _advance() {
    const a = this.active;
    a.idx++;
    if (a.idx >= a.def.objectives.length) return this._complete();
    this._enterObjective();
    this.game.audio.pickup();
    this.game.toast('목표 달성! 다음 목표로', 'good');
  }

  _complete() {
    const def = this.active.def;
    const r = def.reward || {};
    this.game.addScore(r.score || 0, `미션 완료 — ${def.name}`);
    this.game.addCash(r.cash || 0);
    this.completed.add(def.id);
    this.active = null;
    this.refreshMarkers();
    this.game.audio.success();
    this.game.toast(`미션 완료! +${r.score || 0}점 / ₩${(r.cash || 0).toLocaleString()}`, 'good');
    this.game.save();
  }

  fail(reason) {
    if (!this.active) return;
    const name = this.active.def.name;
    this.active = null;
    this.game.audio.fail();
    this.game.toast(`미션 실패 — ${name} (${reason})`, 'bad');
  }

  update(dt) {
    const g = this.game;
    const px = g.player.x;
    const py = g.player.y;

    if (!this.active) {
      for (const d of this.defs) {
        if (!d.repeatable && this.completed.has(d.id)) continue;
        if (Math.hypot(px - d._trigger[0], py - d._trigger[1]) < d._radius) {
          if (d.requiresOnFoot && g.playerVehicle) continue;
          this.start(d);
          break;
        }
      }
      return;
    }

    const a = this.active;
    const def = a.def;
    const o = def.objectives[a.idx];
    a.elapsed += dt;
    if (a.timer !== null) {
      a.timer -= dt;
      if (a.timer <= 0 && def.fail?.onTimeout !== false) return this.fail('시간 초과');
    }
    if (def.fail?.onVehicleDestroyed && a.vehicleRef && a.vehicleRef.wrecked) return this.fail('차량 파손');

    switch (o.type) {
      case 'getInVehicle': {
        const v = g.playerVehicle;
        if (v && (!o.vehicleType || o.vehicleType === v.type || (o.vehicleTypes || []).includes(v.type))) {
          a.vehicleRef = v;
          this._advance();
        }
        break;
      }
      case 'reach': {
        const inZone = Math.hypot(px - o._pos[0], py - o._pos[1]) < o._radius;
        const okVehicle = !o.inVehicle || !!g.playerVehicle;
        if (inZone && okVehicle) this._advance();
        break;
      }
      case 'evade': {
        if (g.wanted.level <= (o.untilStars ?? 0)) this._advance();
        else if (o.duration && a.elapsed > o.duration) this._advance();
        break;
      }
      case 'survive': {
        a.hold += dt;
        if (o.minStars && g.wanted.level < o.minStars) a.hold = Math.max(0, a.hold - dt * 2);
        if (a.hold >= (o.duration || 30)) this._advance();
        break;
      }
      case 'collect': {
        if (!a.spots) {
          a.spots = (o.points || []).map((p) => {
            const ts = g.map.tileSize;
            const n = g.graph.nearest(p[0] * ts, p[1] * ts);
            const [x, y] = n >= 0 ? g.graph.pos[n] : [p[0] * ts, p[1] * ts];
            return { x, y, got: false };
          });
        }
        for (const s of a.spots) {
          if (!s.got && Math.hypot(px - s.x, py - s.y) < o._radius) {
            s.got = true;
            g.audio.pickup();
            g.addScore(o.pointScore || 50);
          }
        }
        if (a.spots.every((s) => s.got)) this._advance();
        break;
      }
      default:
        this._advance();
    }
  }

  /** 수집형 목표의 남은 지점(렌더용) */
  get collectSpots() {
    const a = this.active;
    if (!a || !a.spots) return [];
    return a.spots.filter((s) => !s.got);
  }

  onBusted() {
    if (this.active && this.active.def.fail?.onBusted !== false) this.fail('체포됨');
  }
}

const DEFAULT_TEXT = {
  getInVehicle: '지정된 탈것에 탑승',
  reach: '목표 지점 도달',
  evade: '경찰 따돌리기',
  survive: '추격 버티기',
  collect: '수집품 획득',
};
