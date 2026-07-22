/**
 * police.js — 수배 레벨에 따라 순찰차를 붙인다.
 * 멀면 도로 그래프 A* 로 접근하고, 가까우면 직접 들이받으러 온다.
 * (총격전 없이 차량 액션 중심 — 아케이드 톤 유지)
 */
import { Vehicle } from './vehicle.js';
import { angDiff } from './traffic.js';

export class PoliceForce {
  constructor(map, graph, specs, audio) {
    this.map = map;
    this.graph = graph;
    this.specs = specs;
    this.audio = audio;
    this.units = [];
    this.spawnTimer = 0;
  }

  clear() {
    this.units.length = 0;
  }

  /** 시야 안에서 추격 중인 유닛이 있는가 */
  get chasing() {
    return this.units.some((u) => u.close);
  }

  update(dt, game, cam) {
    const level = game.wanted.level;
    const want = level === 0 ? 0 : Math.min(8, level + Math.floor(level / 2));
    const target = game.playerVehicle || game.player;

    // 스폰
    this.spawnTimer -= dt;
    // 시야에서 벗어난 뒤에는 새 순찰차를 붙이지 않는다.
    // (계속 붙이면 아무리 잘 도망쳐도 추격이 끝나지 않아 재미가 없다)
    const lostSight = game.wanted.cool > 3;
    if (this.units.length < want && this.spawnTimer <= 0 && !lostSight) {
      this.spawnTimer = 1.6;
      this._spawn(target, level, cam);
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const v = u.v;
      if (v.exploded) {
        this.units.splice(i, 1);
        // 경찰차가 제풀에 자멸해도 수배가 오르면 추격이 영원히 불어난다.
        // 플레이어가 근처에 있었을 때만 점수/수배를 준다.
        if (Math.hypot(v.x - target.x, v.y - target.y) < 260) {
          game.wanted.add(0.35);
          game.addScore(150, '경찰차 격파 +150');
        }
        continue;
      }
      // 수배가 풀렸거나 너무 멀면 철수
      const far = Math.hypot(v.x - target.x, v.y - target.y);
      if (level === 0 || far > 2600 || (game.wanted.cool > 5 && far > 1000)) { this.units.splice(i, 1); continue; }

      this._drive(u, dt, target, game);
      v.update(dt, this.map, null);
      u.close = far < 700;
    }

    if (this.units.some((u) => u.close)) this.audio.siren(performance.now() / 1000);
  }

  _spawn(target, level, cam) {
    const g = this.graph;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 900 + Math.random() * 400;
      const x = target.x + Math.cos(a) * r;
      const y = target.y + Math.sin(a) * r;
      if (x < 64 || y < 64 || x > this.map.pxW - 64 || y > this.map.pxH - 64) continue;
      const n = g.nearest(x, y);
      if (n < 0) continue;
      const [nx, ny] = g.pos[n];
      const type = level >= 4 && Math.random() < 0.45 ? 'riot' : 'police';
      const v = new Vehicle(type, this.specs[type], nx, ny, Math.atan2(target.y - ny, target.x - nx));
      v.driver = 'police';
      this.units.push({ v, node: n, path: [], repath: 0, close: false });
      return;
    }
  }

  _drive(u, dt, target, game) {
    const v = u.v;
    if (v.wrecked) { v.ctrl.throttle = 0; v.ctrl.steer = 0; return; }
    const dist = Math.hypot(target.x - v.x, target.y - v.y);
    let tx = target.x;
    let ty = target.y;

    if (dist > 420) {
      // 멀면 도로를 따라 경로 추적
      u.repath -= dt;
      if (u.repath <= 0 || !u.path.length) {
        u.repath = 1.2;
        const from = this.graph.nearest(v.x, v.y);
        const to = this.graph.nearest(target.x, target.y);
        u.path = this.graph.path(from, to);
        u.pi = 0;
      }
      while (u.path.length && u.pi < u.path.length) {
        const [px, py] = this.graph.pos[u.path[u.pi]];
        if (Math.hypot(px - v.x, py - v.y) < 70) u.pi++;
        else { tx = px; ty = py; break; }
      }
    }

    const want = Math.atan2(ty - v.y, tx - v.x);
    const diff = angDiff(want, v.angle);
    v.ctrl.steer = Math.max(-1, Math.min(1, diff * 2.4));
    // 코너에서 과속하지 않게 각도가 크면 감속
    const aligned = 1 - Math.min(1, Math.abs(diff) / 1.4);
    v.ctrl.throttle = Math.abs(diff) > 2.2 && v.speed > 60 ? -0.8 : 0.5 + aligned * 0.5;
    v.ctrl.boost = dist > 300 && Math.abs(diff) < 0.6;
    v.ctrl.handbrake = false;

    // 플레이어를 들이받으면 데미지
    const pv = game.playerVehicle;
    u.ramCd = Math.max(0, (u.ramCd || 0) - dt);
    if (pv && dist < (v.len + pv.len) * 0.45) {
      const rel = Math.hypot(v.vx - pv.vx, v.vy - pv.vy);
      if (rel > 100 && u.ramCd === 0) {
        u.ramCd = 0.5;
        pv.damage(Math.min(16, rel / 34), this.audio);
        v.damage(Math.min(10, rel / 46), this.audio);
        game.cam.shake = Math.min(1, game.cam.shake + 0.4);
      }
    } else if (!pv && dist < 34) {
      // 도보 상태로 붙잡히면 체포 — 즉사가 아니라 1초 정도 붙잡혀 있어야 한다
      u.grab = (u.grab || 0) + dt;
      if (u.grab > 1) game.onBusted();
    } else if (u.grab) {
      u.grab = Math.max(0, u.grab - dt);
    }
  }

  draw(ctx, cam, t) {
    const b = cam.bounds(90);
    for (const u of this.units) {
      const v = u.v;
      if (v.x < b.x0 || v.x > b.x1 || v.y < b.y0 || v.y > b.y1) continue;
      v.draw(ctx, t);
      // 경광등 빛 번짐
      const on = Math.floor(v.sirenT * 6) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = on ? '#ff3b3b' : '#3b6bff';
      ctx.beginPath();
      ctx.arc(v.x, v.y, 34, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }
}
