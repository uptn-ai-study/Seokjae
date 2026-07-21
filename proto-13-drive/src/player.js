/**
 * player.js — 플레이어 차량 (아케이드 반물리 + 유연한 도로 스냅)
 *
 * "강제 레일"이 아니라 도로 폭 안에서의 정렬:
 *   - 도로 폭 안: 완전 자유
 *   - 도로 폭 밖(연석 넘김): 접지력 저하 + 도로 쪽으로 부드럽게 되밀림
 * 덕분에 교차로에서는 조향 입력대로 원하는 길로 자연스럽게 진입한다.
 */
import { clamp, normAngle, lerpAngle } from './geo.js';

const KMH = 1 / 3.6;

export class Player {
  constructor(graph, spawn) {
    this.g = graph;
    this.x = spawn.x;
    this.y = spawn.y;
    this.heading = spawn.heading;
    this.speed = 0; // m/s (음수 = 후진)
    this.offroad = false;
    this.road = null; // 현재 올라탄 엣지
    this.roadName = '';
    this.roadHeading = null; // 진행 방향에 맞춘 도로 방위
    this.bumpTimer = 0;
    this.odo = 0; // 누적 주행거리 (m)

    // 차량 제원
    this.length = 4.4;
    this.width = 1.85;

    // 아케이드 파라미터
    this.accel = 10; // m/s² (저속 기준, 고속에서 체감 가속은 완만해진다)
    this.brakeDecel = 19;
    this.maxSpeed = 69.4; // = 250 km/h
    this.maxReverse = 7;
    this.maxTurn = 2.6; // rad/s — 저속에서의 조향 상한
    this.maxLateral = 14; // m/s² — 속도가 붙을수록 회전반경이 커지게 하는 횡가속 상한
  }

  get speedKmh() {
    return Math.abs(this.speed) / KMH;
  }

  update(dt, input) {
    // ---- 종방향 ----
    if (input.reverse && this.speed <= 0.4) {
      // 정지 상태에서 아래키 → 후진
      this.speed -= this.accel * 0.6 * dt;
      this.speed = Math.max(this.speed, -this.maxReverse);
    } else {
      if (input.throttle > 0) {
        // 최고속에 가까워질수록 가속이 둔해진다 (250km/h 까지 약 12초)
        const taper = 1 - 0.72 * Math.min(1, Math.abs(this.speed) / this.maxSpeed);
        this.speed += this.accel * taper * input.throttle * dt;
      }
      if (input.brake > 0) {
        const d = this.brakeDecel * input.brake * dt;
        this.speed = this.speed > 0 ? Math.max(0, this.speed - d) : Math.min(0, this.speed + d);
      }
    }

    // 저항 (구름 + 공기), 비포장(오프로드)은 더 크게
    const drag = (this.offroad ? 5 : 1.2) + (this.offroad ? 0.0025 : 0.0011) * this.speed * this.speed;
    if (input.throttle === 0 || this.offroad) {
      const d = drag * dt;
      this.speed = this.speed > 0 ? Math.max(0, this.speed - d) : Math.min(0, this.speed + d);
    }
    const cap = this.offroad ? this.maxSpeed * 0.45 : this.maxSpeed;
    this.speed = clamp(this.speed, -this.maxReverse, cap);

    // ---- 조향 ----
    // 횡가속 상한(maxLateral)으로 회전율을 제한 → 빠를수록 회전반경이 커진다.
    // 250km/h 로 도심 골목을 꺾을 수는 없고, 코너 앞에선 감속해야 한다.
    const v = Math.abs(this.speed);
    const turnCap = Math.min(this.maxTurn, this.maxLateral / Math.max(3, v));
    const fade = clamp(v / 3, 0, 1); // 정지 상태에서 제자리 회전 방지
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += input.steer * turnCap * fade * dir * dt;

    // 조향 입력이 없고 도로 위일 때만 아주 약하게 차선에 정렬시킨다.
    // (고속에서 직선로를 유지하기 쉬워지되, 입력이 들어오면 즉시 무시된다)
    if (input.steer === 0 && v > 5 && this.roadHeading != null) {
      const k = Math.min(0.3, dt * (0.8 + v * 0.03));
      this.heading = lerpAngle(this.heading, this.roadHeading, k);
    }
    this.heading = normAngle(this.heading);

    // ---- 이동 ----
    const dx = Math.cos(this.heading) * this.speed * dt;
    const dy = Math.sin(this.heading) * this.speed * dt;
    this.x += dx;
    this.y += dy;
    this.odo += Math.abs(this.speed) * dt;

    // ---- 도로 스냅 ----
    this._snapToRoad(dt);

    if (this.bumpTimer > 0) this.bumpTimer -= dt;
  }

  _snapToRoad(dt) {
    const hit = this.g.nearest(this.x, this.y, 90);
    if (!hit) {
      // 도로에서 완전히 벗어난 예외 상황 — 강하게 되돌린다
      this.offroad = true;
      this.roadHeading = null;
      this.speed *= 0.9;
      return;
    }
    this.road = hit.edge;
    this.roadName = hit.edge.name;
    // 진행 방향에 맞춘 도로 방위 (정렬 보조용)
    const rh = hit.heading;
    const back = Math.cos(this.heading) * Math.cos(rh) + Math.sin(this.heading) * Math.sin(rh) < 0;
    this.roadHeading = back ? rh + Math.PI : rh;

    const allowed = hit.edge.width / 2 + 2.0;
    const over = hit.dist - allowed;
    if (over > 0) {
      // 도로 중심 쪽으로 부드럽게 되밀기 (넘어간 양에 비례)
      const pull = Math.min(over, 8 * dt + over * 0.35);
      const nx = (hit.x - this.x) / (hit.dist || 1);
      const ny = (hit.y - this.y) / (hit.dist || 1);
      this.x += nx * pull;
      this.y += ny * pull;
    }
    // 살짝 걸친 정도로는 오프로드로 치지 않는다 (경계에서 깜빡이는 것 방지)
    this.offroad = over > 1.0;
  }

  /** AI 차량 등과 충돌했을 때의 가벼운 반응 */
  bump(nx, ny, strength = 1) {
    this.x += nx * 0.6 * strength;
    this.y += ny * 0.6 * strength;
    this.speed *= 0.55;
    this.bumpTimer = 0.35;
  }

  teleport(x, y, heading) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
  }
}
