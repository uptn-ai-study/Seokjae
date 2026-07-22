/**
 * vehicle.js — 아케이드 주행 모델.
 *
 * 속도에 비례한 조향 + 횡방향 속도 감쇠(그립)로 굴러가고,
 * 핸드브레이크는 그립을 확 낮춰 드리프트를 만든다. 사실성보다 손맛.
 */
import { moveWithTiles } from '../systems/collision.js';

export class Vehicle {
  constructor(type, spec, x, y, angle = 0) {
    this.type = type;
    this.spec = spec;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.len = spec.h;
    this.wid = spec.w;
    this.mass = spec.mass;
    this.maxHp = spec.hp;
    this.hp = spec.hp;
    this.driver = null; // 'player' | 'ai' | 'police' | null
    this.wrecked = false;
    this.exploded = false;
    this.drift = 0;
    this.skid = [];
    this.sirenT = 0;
    this.ctrl = { throttle: 0, steer: 0, handbrake: false, boost: false };
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  /** 진행 방향 기준 속도(후진이면 음수) */
  get forwardSpeed() { return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle); }

  damage(amount, audio) {
    if (this.wrecked) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.wrecked = true;
      this.explodeAt = 1.6; // 잠시 연기 후 폭발
      audio?.crash(1);
    }
  }

  update(dt, map, audio) {
    const s = this.spec;
    const c = this.ctrl;

    if (this.wrecked) {
      c.throttle = 0;
      c.steer = 0;
      if (this.explodeAt > 0) {
        this.explodeAt -= dt;
        if (this.explodeAt <= 0 && !this.exploded) {
          this.exploded = true;
          audio?.explode();
        }
      }
    }

    const fwd = this.forwardSpeed;
    const sp = this.speed;

    // 조향 — 멈춰 있으면 돌지 않는다
    const steerAuth = Math.min(1, sp / 90);
    const dirSign = fwd < -4 ? -1 : 1;
    this.angle += c.steer * s.steer * steerAuth * dirSign * dt;

    // 가속 / 후진
    const boost = c.boost && c.throttle > 0 ? 1.35 : 1;
    const max = s.maxSpeed * boost;
    const ax = Math.cos(this.angle);
    const ay = Math.sin(this.angle);
    if (c.throttle > 0) {
      if (fwd < max) {
        this.vx += ax * s.accel * boost * c.throttle * dt;
        this.vy += ay * s.accel * boost * c.throttle * dt;
      }
    } else if (c.throttle < 0) {
      if (fwd > 40) {
        // 전진 중 뒤 입력은 브레이크
        this.vx -= this.vx * 3.2 * dt;
        this.vy -= this.vy * 3.2 * dt;
      } else if (fwd > -s.reverse) {
        this.vx -= ax * s.accel * 0.55 * dt;
        this.vy -= ay * s.accel * 0.55 * dt;
      }
    }

    // 구름 저항
    const drag = c.throttle === 0 ? 1.1 : 0.35;
    this.vx -= this.vx * drag * dt;
    this.vy -= this.vy * drag * dt;

    // 그립 — 횡방향 속도를 없애 차가 앞으로 달리게 한다
    const latX = this.vx - ax * fwd;
    const latY = this.vy - ay * fwd;
    const gripK = c.handbrake ? s.grip * 0.16 : s.grip;
    const k = Math.min(1, gripK * dt);
    this.vx -= latX * k;
    this.vy -= latY * k;
    if (c.handbrake) {
      this.vx -= this.vx * 1.1 * dt;
      this.vy -= this.vy * 1.1 * dt;
    }

    this.drift = Math.min(1, Math.hypot(latX, latY) / 160);

    // 잔디·물 위는 느리게
    if (!map.isRoadPx(this.x, this.y)) {
      this.vx -= this.vx * 0.9 * dt;
      this.vy -= this.vy * 0.9 * dt;
    }

    // 벽에 긁히는 동안 매 프레임 데미지가 들어가면 순식간에 터진다 — 쿨다운을 둔다
    this.hitCd = Math.max(0, (this.hitCd || 0) - dt);
    const impact = moveWithTiles(map, this, dt);
    if (impact > 180 && this.hitCd === 0) {
      this.hitCd = 0.4;
      this.damage(Math.min(18, impact / 42), audio);
      audio?.crash(Math.min(1, impact / 600));
      this.lastImpact = impact;
    } else this.lastImpact = 0;

    // 드리프트/급제동 스키드 마크
    if (this.drift > 0.45 && sp > 120) {
      this.skid.push({ x: this.x, y: this.y, a: this.angle, t: 3 });
      if (this.skid.length > 60) this.skid.shift();
    }
    for (let i = this.skid.length - 1; i >= 0; i--) {
      this.skid[i].t -= dt;
      if (this.skid[i].t <= 0) this.skid.splice(i, 1);
    }
    this.sirenT += dt;
  }

  drawSkid(ctx) {
    for (const s of this.skid) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.3, s.t * 0.1);
      ctx.fillStyle = '#15151a';
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillRect(-this.len / 2, -this.wid / 2 + 1, 7, 3);
      ctx.fillRect(-this.len / 2, this.wid / 2 - 4, 7, 3);
      ctx.restore();
    }
  }

  draw(ctx, t) {
    const s = this.spec;
    const L = this.len;
    const W = this.wid;
    ctx.save();
    ctx.translate(this.x, this.y);

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
    ctx.restore();

    ctx.rotate(this.angle);
    const dmg = this.hp / this.maxHp;
    ctx.fillStyle = this.wrecked ? '#3a3a3e' : s.color;
    roundRect(ctx, -L / 2, -W / 2, L, W, s.bike ? 3 : 5);
    ctx.fill();
    if (dmg < 0.7 && !this.wrecked) {
      ctx.fillStyle = `rgba(24,20,18,${(0.7 - dmg) * 0.7})`;
      ctx.fill();
    }

    // 지붕/좌석
    ctx.fillStyle = this.wrecked ? '#2a2a2e' : s.roof;
    if (s.bike) ctx.fillRect(-L * 0.1, -W / 2, L * 0.34, W);
    else ctx.fillRect(-L * 0.22, -W / 2 + 3, L * 0.5, W - 6);

    // 앞유리 하이라이트
    if (!s.bike) {
      ctx.fillStyle = 'rgba(180,220,255,0.35)';
      ctx.fillRect(L * 0.2, -W / 2 + 3, L * 0.12, W - 6);
    }

    // 헤드라이트
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 4);
    ctx.fillRect(L / 2 - 3, W / 2 - 6, 3, 4);
    // 브레이크등
    if (this.ctrl.throttle < 0 || this.ctrl.handbrake) {
      ctx.fillStyle = '#ff5a48';
      ctx.fillRect(-L / 2, -W / 2 + 2, 3, 4);
      ctx.fillRect(-L / 2, W / 2 - 6, 3, 4);
    }

    // 경광등
    if (s.siren) {
      const on = Math.floor(this.sirenT * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b3b' : '#3b6bff';
      ctx.fillRect(-2, -W / 2 - 1, 5, W + 2);
    }
    ctx.restore();

    // 파손 연기
    if (this.hp / this.maxHp < 0.35) {
      const n = this.wrecked ? 5 : 2;
      for (let i = 0; i < n; i++) {
        const p = (t * 0.7 + i * 0.4) % 1;
        ctx.globalAlpha = (1 - p) * 0.35;
        ctx.fillStyle = this.wrecked ? '#33383f' : '#6b7280';
        ctx.beginPath();
        ctx.arc(this.x - Math.cos(this.angle) * 12, this.y - Math.sin(this.angle) * 12 - p * 26, 5 + p * 14, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
