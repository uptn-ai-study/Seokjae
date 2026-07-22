/**
 * traffic.js — 카메라 주변에서만 도는 NPC 시뮬레이션.
 * 일반 차량은 도로 그래프를 따라 달리고, 보행자는 인도를 배회한다.
 * 멀어진 개체는 폐기(despawn)하고 다시 링 바깥에서 생성한다.
 */
import { Vehicle } from './vehicle.js';
import { moveCircle, separate } from '../systems/collision.js';

export const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * 붙어 있는 차를 액셀로 밀어낸다.
 * 무거운 차일수록 잘 밀고, 가벼운 차는 잘 밀린다. (버스로 스쿠터 밀기 = 쉬움)
 */
function shove(pusher, target, dt) {
  const th = pusher.ctrl.throttle;
  if (!dt || Math.abs(th) < 0.2 || pusher.wrecked) return;
  const dir = th > 0 ? 1 : -1;
  const ax = Math.cos(pusher.angle) * dir;
  const ay = Math.sin(pusher.angle) * dir;
  // 미는 방향 앞쪽에 있는 상대만
  const dx = target.x - pusher.x;
  const dy = target.y - pusher.y;
  const d = Math.hypot(dx, dy) || 1;
  const facing = (dx * ax + dy * ay) / d;
  if (facing < 0.4) return;
  const force = 260 * Math.abs(th) * (pusher.mass / (pusher.mass + target.mass));
  target.vx += ax * force * dt;
  target.vy += ay * force * dt;
  // 미는 쪽도 그만큼 버거워진다
  pusher.vx -= ax * force * 0.35 * dt;
  pusher.vy -= ay * force * 0.35 * dt;
}

export const FREE_WAY = 0;
export const WALL = 1; // 건물·물 — 밀 수 없다
export const CAR = 2; // 차량 — 액셀로 밀어낼 수 있다

/** 해당 지점을 막고 있는 것의 종류 */
export function blockKind(map, x, y, vehicles, skip, r = 32) {
  for (const o of vehicles) {
    if (o === skip) continue;
    if (Math.abs(o.x - x) < r && Math.abs(o.y - y) < r) return CAR;
  }
  return map.solidAtPx(x, y) !== 0 ? WALL : FREE_WAY;
}

/**
 * 갇힌 차량의 탈출 기동을 정한다. traffic/police 가 공유한다.
 *   앞이 차 → 액셀로 민다 / 뒤가 비었으면 → 각을 틀어 후진
 *   뒤도 차 → 후진으로 밀어낸다 / 앞뒤 다 벽 → 전후진 번갈아 비집고 나온다
 * @returns {boolean} 이번 프레임 조작을 가져갔는가
 */
export function escapeManeuver(s, v, dt, map, others, jammed) {
  if (s.escape > 0) {
    s.escape -= dt;
    v.ctrl.boost = false;
    v.ctrl.handbrake = false;
    if (s.escapeMode === 'push') {
      v.ctrl.throttle = 1;
      v.ctrl.steer *= 0.3;
    } else if (s.escapeMode === 'reverse') {
      v.ctrl.throttle = -1;
      v.ctrl.steer = s.escapeSteer;
    } else {
      // wiggle — 전반부는 후진, 후반부는 반대 조향으로 전진
      const back = s.escape > s.escapeLen * 0.5;
      v.ctrl.throttle = back ? -1 : 1;
      v.ctrl.steer = back ? s.escapeSteer : -s.escapeSteer;
    }
    return true;
  }

  s.stuck = jammed ? (s.stuck || 0) + dt : Math.max(0, (s.stuck || 0) - dt * 2);
  if (s.stuck < 1.4) return false;
  s.stuck = 0;

  const ax = Math.cos(v.angle);
  const ay = Math.sin(v.angle);
  const reach = v.len * 0.5 + 26;
  const front = blockKind(map, v.x + ax * reach, v.y + ay * reach, others, v, 32);
  const rear = blockKind(map, v.x - ax * reach, v.y - ay * reach, others, v, 32);

  s.escapeSteer = Math.random() < 0.5 ? -1 : 1;
  if (front === CAR) {
    s.escapeMode = 'push';
    s.escapeLen = 1.1;
  } else if (rear === FREE_WAY) {
    s.escapeMode = 'reverse';
    s.escapeLen = 1.0;
  } else if (rear === CAR) {
    s.escapeMode = 'reverse';
    s.escapeSteer = 0; // 뒤차를 곧게 밀어낸다
    s.escapeLen = 1.1;
  } else {
    s.escapeMode = 'wiggle';
    s.escapeLen = 1.8;
  }
  s.escape = s.escapeLen;
  return escapeManeuver(s, v, dt, map, others, jammed);
}

const CAR_TYPES = ['sedan', 'sedan', 'suv', 'sports', 'scooter', 'moto', 'bus', 'truck'];
const PED_COLORS = ['#e2574c', '#4c8fe2', '#e2c14c', '#7ad17a', '#c07ae2', '#e28a4c', '#f2f2f2'];

export class Traffic {
  constructor(map, graph, specs, audio) {
    this.map = map;
    this.graph = graph;
    this.specs = specs;
    this.audio = audio;
    this.cars = [];
    this.peds = [];
    this.maxCars = 26;
    this.maxPeds = 34;
  }

  densityScale(theme) {
    return { office: 1.15, commercial: 1.3, residential: 0.9, suburb: 0.55, highway: 0.8 }[theme] ?? 0.8;
  }

  update(dt, cam, player, game) {
    const scale = this.densityScale(game.district?.theme);
    this._maintain(cam, Math.round(this.maxCars * scale), Math.round(this.maxPeds * scale), game);

    // 전방/후방 감지에 쓰는 차량 목록은 프레임당 한 번만 만든다
    const all = game.vehicleList();
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (this._tooFar(c.v, cam, 1600) || c.v.exploded) { this.cars.splice(i, 1); continue; }
      if (c.v.driver === 'player') { this.cars.splice(i, 1); continue; }
      this._driveAI(c, dt, player, game, all);
      c.v.update(dt, this.map, null);
    }

    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (this._tooFar(p, cam, 1300) || p.dead) { this.peds.splice(i, 1); continue; }
      this._walk(p, dt, game);
    }

    this._resolve(game, player, dt);
  }

  _tooFar(e, cam, r) {
    return Math.abs(e.x - cam.x) > r || Math.abs(e.y - cam.y) > r;
  }

  _maintain(cam, wantCars, wantPeds, game) {
    let guard = 0;
    while (this.cars.length < wantCars && guard++ < 6) {
      const spot = this._ringSpot(cam, 700, 1300, true);
      if (!spot) break;
      const type = CAR_TYPES[(Math.random() * CAR_TYPES.length) | 0];
      const spec = this.specs[type];
      const node = this.graph.nearest(spot.x, spot.y);
      if (node < 0) break;
      const [nx, ny] = this.graph.pos[node];
      const v = new Vehicle(type, spec, nx, ny, Math.random() * Math.PI * 2);
      v.driver = 'ai';
      const next = this.graph.nextFrom(node, -1);
      v.angle = Math.atan2(this.graph.pos[next][1] - ny, this.graph.pos[next][0] - nx);
      this.cars.push({ v, node, prev: node, target: next, wait: 0 });
    }
    guard = 0;
    while (this.peds.length < wantPeds && guard++ < 8) {
      const spot = this._ringSpot(cam, 500, 1100, false);
      if (!spot) break;
      this.peds.push({
        x: spot.x, y: spot.y, vx: 0, vy: 0, mass: 0.25,
        dir: Math.random() * Math.PI * 2, phase: Math.random() * 6,
        color: PED_COLORS[(Math.random() * PED_COLORS.length) | 0],
        panic: 0, think: 0,
      });
    }
  }

  /** 카메라 주변 링에서 도로(또는 인도) 위 지점을 찾는다 */
  _ringSpot(cam, rmin, rmax, road) {
    const m = this.map;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rmin + Math.random() * (rmax - rmin);
      const x = cam.x + Math.cos(a) * r;
      const y = cam.y + Math.sin(a) * r;
      if (x < 64 || y < 64 || x > m.pxW - 64 || y > m.pxH - 64) continue;
      if (road ? m.isRoadPx(x, y) : m.isWalkPx(x, y)) return { x, y };
    }
    return null;
  }

  _driveAI(c, dt, player, game, all) {
    const v = c.v;
    if (v.wrecked) { v.ctrl.throttle = 0; v.ctrl.steer = 0; return; }
    const g = this.graph;
    let [tx, ty] = g.pos[c.target];
    const dx = tx - v.x;
    const dy = ty - v.y;
    if (dx * dx + dy * dy < 44 * 44) {
      const nn = g.nextFrom(c.target, c.node, 1);
      c.node = c.target;
      c.target = nn;
      [tx, ty] = g.pos[c.target];
    }
    // 우측통행 — 목표점을 진행방향 오른쪽으로 살짝 밀어 마주 오는 차와 안 겹치게
    const ex = tx - g.pos[c.node][0];
    const ey = ty - g.pos[c.node][1];
    const el = Math.hypot(ex, ey) || 1;
    tx += (-ey / el) * 14;
    ty += (ex / el) * 14;

    const want = Math.atan2(ty - v.y, tx - v.x);
    const diff = angDiff(want, v.angle);
    v.ctrl.steer = Math.max(-1, Math.min(1, diff * 2.2));
    v.ctrl.handbrake = false;

    // 전방 감지 — 차·플레이어·보행자·벽
    const ax = Math.cos(v.angle);
    const ay = Math.sin(v.angle);
    const px = v.x + ax * (v.len * 0.5 + 30);
    const py = v.y + ay * (v.len * 0.5 + 30);
    let blockedAhead = blockKind(this.map, px, py, all, v, 34) !== FREE_WAY;
    if (!blockedAhead) {
      for (const p of this.peds) {
        if (Math.abs(p.x - px) < 26 && Math.abs(p.y - py) < 26) { blockedAhead = true; break; }
      }
    }

    // 갇혔으면 탈출 기동이 조작을 가져간다
    const jammed = blockedAhead || (v.ctrl.throttle > 0.1 && v.speed < 26);
    if (escapeManeuver(c, v, dt, this.map, all, jammed)) return;

    const aligned = 1 - Math.min(1, Math.abs(diff) / 1.2);
    if (blockedAhead) {
      c.wait += dt;
      v.ctrl.throttle = -0.6;
    } else {
      c.wait = 0;
      v.ctrl.throttle = 0.45 + aligned * 0.55;
      // 과속 방지 — NPC 는 최고속의 60% 정도로 순항
      if (v.forwardSpeed > v.spec.maxSpeed * 0.6) v.ctrl.throttle = 0;
    }
  }

  _walk(p, dt, game) {
    const m = this.map;
    p.think -= dt;
    p.panic = Math.max(0, p.panic - dt);

    // 위험(빠른 차)이 가까우면 도망
    const pv = game.playerVehicle;
    if (pv && pv.speed > 90) {
      const d = Math.hypot(pv.x - p.x, pv.y - p.y);
      if (d < 120) {
        p.dir = Math.atan2(p.y - pv.y, p.x - pv.x);
        p.panic = 1.2;
        p.think = 0.6;
      }
    }
    if (p.think <= 0) {
      p.think = 0.8 + Math.random() * 1.8;
      if (Math.random() < 0.5) p.dir += (Math.random() - 0.5) * 2.4;
    }
    const speed = p.panic > 0 ? 165 : 52;
    const nx = p.x + Math.cos(p.dir) * 22;
    const ny = p.y + Math.sin(p.dir) * 22;
    // 인도를 벗어나려 하면 방향을 튼다(패닉 중엔 무시하고 도로도 건넌다)
    if (!m.isWalkPx(nx, ny) && p.panic <= 0) {
      p.dir += Math.PI / 2 + Math.random() * 1.2;
    }
    p.vx = Math.cos(p.dir) * speed;
    p.vy = Math.sin(p.dir) * speed;
    p.phase += dt * (p.panic > 0 ? 16 : 7);
    if (moveCircle(m, p, dt, 7) > 0) p.dir += Math.PI * 0.6 + Math.random();
  }

  /** 차량끼리 / 차량-보행자 충돌 */
  _resolve(game, player, dt) {
    const all = game.vehicleList();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (Math.abs(a.x - b.x) > 90 || Math.abs(a.y - b.y) > 90) continue;
        const rel = separate(a, b, a.len * 0.38, b.len * 0.38, 0.35);
        shove(a, b, dt);
        shove(b, a, dt);
        if (rel > 150) {
          const dmg = Math.min(16, rel / 36);
          a.damage(dmg, this.audio);
          b.damage(dmg, this.audio);
          if (a === game.playerVehicle || b === game.playerVehicle) {
            this.audio.crash(Math.min(1, rel / 420));
            game.onCollision(rel, b === game.playerVehicle ? a : b);
          }
        }
      }
    }
    // 차 vs 보행자
    for (const p of this.peds) {
      for (const v of all) {
        if (Math.abs(v.x - p.x) > 60 || Math.abs(v.y - p.y) > 60) continue;
        const d = Math.hypot(v.x - p.x, v.y - p.y);
        if (d < v.len * 0.4 + 8 && v.speed > 60) {
          p.dead = true;
          p.panic = 2;
          if (v === game.playerVehicle) game.onPedestrianHit();
          this.audio.crash(0.4);
        } else if (d < v.len * 0.42 + 10) {
          p.dir = Math.atan2(p.y - v.y, p.x - v.x);
          p.panic = 1.4;
        }
      }
      // 도보 플레이어와 부딪히면 밀림
      if (Math.abs(p.x - player.x) < 24 && Math.abs(p.y - player.y) < 24 && !player.vehicle) {
        separate(player, p, 9, 7, 0.2);
      }
    }
  }

  drawPeds(ctx, cam) {
    const b = cam.bounds(40);
    for (const p of this.peds) {
      if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x + 2, p.y + 3, 7, 5, 0, 0, 7);
      ctx.fill();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.dir);
      const sw = Math.sin(p.phase) * 3;
      ctx.fillStyle = '#2a3140';
      ctx.fillRect(-2, -7 + sw * 0.5, 6, 3);
      ctx.fillRect(-2, 4 - sw * 0.5, 6, 3);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  drawCars(ctx, cam, t) {
    const b = cam.bounds(80);
    for (const c of this.cars) {
      const v = c.v;
      if (v.x < b.x0 || v.x > b.x1 || v.y < b.y0 || v.y > b.y1) continue;
      v.draw(ctx, t);
    }
  }
}
