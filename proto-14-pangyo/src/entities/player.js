/**
 * player.js — 도보 상태의 플레이어. 차에 타면 update 를 건너뛴다.
 */
import { moveCircle } from '../systems/collision.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.r = 9;
    this.maxHp = 100;
    this.hp = 100;
    this.stamina = 1;
    this.vehicle = null;
    this.walkPhase = 0;
    this.invuln = 0;
  }

  get inVehicle() { return !!this.vehicle; }

  update(dt, input, map) {
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.vehicle) {
      this.x = this.vehicle.x;
      this.y = this.vehicle.y;
      this.angle = this.vehicle.angle;
      this.stamina = Math.min(1, this.stamina + dt * 0.35);
      return;
    }
    const mx = input.moveX;
    const my = input.moveY;
    const len = Math.hypot(mx, my);
    const running = input.boost && this.stamina > 0.02 && len > 0.1;
    const speed = running ? 215 : 128;
    if (len > 0.12) {
      this.vx = (mx / len) * speed * Math.min(1, len * 1.4);
      this.vy = (my / len) * speed * Math.min(1, len * 1.4);
      this.angle = Math.atan2(this.vy, this.vx);
      this.walkPhase += dt * (running ? 14 : 9);
    } else {
      this.vx *= 1 - Math.min(1, 12 * dt);
      this.vy *= 1 - Math.min(1, 12 * dt);
    }
    this.stamina = Math.max(0, Math.min(1, this.stamina + (running ? -dt * 0.32 : dt * 0.28)));
    moveCircle(map, this, dt, this.r);
  }

  hurt(n) {
    if (this.invuln > 0) return false;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 0.6;
    return true;
  }

  draw(ctx) {
    if (this.vehicle) return;
    const { x, y } = this;
    ctx.save();
    // 위치 강조 링 — 도시가 복잡해도 내가 어디 있는지 즉시 보이게
    ctx.strokeStyle = 'rgba(255,210,63,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, 9, 6, 0, 0, 7);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(this.angle);
    // 팔다리 흔들림
    const sw = Math.sin(this.walkPhase) * 4;
    ctx.fillStyle = '#26303f';
    ctx.fillRect(-2, -8 + sw * 0.4, 8, 4);
    ctx.fillRect(-2, 4 - sw * 0.4, 8, 4);
    // 몸통
    ctx.fillStyle = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 ? '#ff8a8a' : '#f0c27b';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#2f6fb5';
    ctx.beginPath();
    ctx.arc(-1, 0, 6, 0, 7);
    ctx.fill();
    // 시선 방향 표시
    ctx.fillStyle = '#1c2029';
    ctx.fillRect(5, -2, 4, 4);
    ctx.restore();
  }
}
