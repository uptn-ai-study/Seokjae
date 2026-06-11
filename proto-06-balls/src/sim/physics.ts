// 당구 물리 — 저사양 모바일을 위한 경량 구현
// 회전(잉글리시/당점) 포함 단순화 모델:
//  - 이동: 지수 감쇠 마찰 + 등감속
//  - 충돌: 원-원 등질량 탄성, 쿠션 반사
//  - 회전: 옆돌리기(e, 좌우 회전)는 진행 중 곡구 + 쿠션 반사각 변화,
//          끌어/밀어(f, 전후 회전)는 적구 충돌 후 수구의 따라가기/되돌아오기로 반영

export const TABLE_W = 500 // 단변(논리 단위) — 모바일 세로 화면에 맞춰 장축을 세로로 둔다
export const TABLE_H = 1000 // 장변
export const BALL_R = 16
export const PAD = 36 // 렌더용 프레임(레일) 두께

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  e: number // 옆회전(잉글리시): 우회전 +, 좌회전 −
  f: number // 전후회전: 밀어치기(따라) +, 끌어치기(되돌림) −
}

export interface StepEvents {
  cushions: number[] // 쿠션에 닿은 공 인덱스
  hits: Array<[number, number]> // 충돌한 공 쌍 인덱스
  impacts: number[] // 충돌 상대속도(사운드 볼륨 산정용)
}

const FRICTION = 0.35 // 1/s, 지수 감쇠 마찰
const DECEL = 18 // 단위/s^2, 등감속(저속 구간에서 확실히 멈추도록)
const STOP_V = 8 // 이하 속도는 정지 처리
const WALL_E = 0.9 // 쿠션 반발 계수
const BALL_E = 0.95 // 공-공 반발 계수

const ENGLISH_FRICTION = 1.3 // 옆회전 감쇠(빠르게 사라짐)
const FOLLOW_FRICTION = 0.9 // 전후회전 감쇠
const CURVE_K = 0.16 // 옆회전에 의한 곡구(휘어짐) 가속 계수
const RAIL_SPIN = 0.32 // 쿠션 반사 시 옆회전이 만드는 접선 방향 가속
const FOLLOW_K = 0.6 // 적구 충돌 후 끌어/밀어가 더하는 진행 방향 속도 계수

export function makeBall(x: number, y: number): Ball {
  return { x, y, vx: 0, vy: 0, e: 0, f: 0 }
}

export function allStopped(balls: Ball[]): boolean {
  return balls.every((b) => b.vx === 0 && b.vy === 0)
}

// 적구 충돌 직후, 충돌 전 진행 방향(vx0,vy0)으로 끌어/밀어 회전을 속도에 반영
function applyFollow(b: Ball, vx0: number, vy0: number): void {
  const s = Math.hypot(vx0, vy0)
  if (Math.abs(b.f) <= 0.02 || s <= STOP_V) return
  const add = b.f * FOLLOW_K * s
  b.vx += (vx0 / s) * add
  b.vy += (vy0 / s) * add
  b.f *= 0.25 // 회전 대부분 소모
}

export function stepPhysics(balls: Ball[], dt: number, ev: StepEvents): void {
  let maxV = 0
  for (const b of balls) maxV = Math.max(maxV, Math.hypot(b.vx, b.vy))
  if (maxV === 0) return

  // 가장 빠른 공이 한 서브스텝에 반지름의 절반 이상 이동하지 않도록 분할(터널링 방지)
  const steps = Math.min(8, Math.max(1, Math.ceil((maxV * dt) / (BALL_R * 0.45))))
  const h = dt / steps

  for (let s = 0; s < steps; s++) {
    // 1) 마찰 + 곡구 + 이동 + 쿠션 반사
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i]
      const sp = Math.hypot(b.vx, b.vy)
      if (sp === 0) continue

      // 마찰(지수 감쇠 + 등감속)
      const nsp = sp * Math.exp(-FRICTION * h) - DECEL * h
      if (nsp <= STOP_V) {
        b.vx = 0
        b.vy = 0
        b.e = 0
        b.f = 0
        continue
      }
      const fr = nsp / sp
      b.vx *= fr
      b.vy *= fr

      // 옆회전에 의한 곡구: 진행 방향의 오른쪽으로 휘어짐(우회전 +)
      if (b.e !== 0) {
        const inv = 1 / nsp
        const rx = -b.vy * inv // 진행 방향의 오른쪽 단위벡터
        const ry = b.vx * inv
        const acc = CURVE_K * b.e * nsp
        b.vx += rx * acc * h
        b.vy += ry * acc * h
      }

      // 회전 감쇠
      b.e *= Math.exp(-ENGLISH_FRICTION * h)
      b.f *= Math.exp(-FOLLOW_FRICTION * h)

      // 이동
      b.x += b.vx * h
      b.y += b.vy * h

      // 쿠션 반사 (+ 옆회전에 의한 접선 가속/반사각 변화)
      if (b.x < BALL_R) {
        b.x = BALL_R * 2 - b.x
        if (b.vx < 0) {
          const vin = -b.vx
          b.vx = -b.vx * WALL_E
          b.vy -= RAIL_SPIN * b.e * vin // 좌측 레일: 접선(−y)
          b.e *= 0.5
          ev.cushions.push(i)
          ev.impacts.push(vin)
        }
      } else if (b.x > TABLE_W - BALL_R) {
        b.x = (TABLE_W - BALL_R) * 2 - b.x
        if (b.vx > 0) {
          const vin = b.vx
          b.vx = -b.vx * WALL_E
          b.vy += RAIL_SPIN * b.e * vin // 우측 레일: 접선(+y)
          b.e *= 0.5
          ev.cushions.push(i)
          ev.impacts.push(vin)
        }
      }
      if (b.y < BALL_R) {
        b.y = BALL_R * 2 - b.y
        if (b.vy < 0) {
          const vin = -b.vy
          b.vy = -b.vy * WALL_E
          b.vx += RAIL_SPIN * b.e * vin // 상단 레일: 접선(+x)
          b.e *= 0.5
          ev.cushions.push(i)
          ev.impacts.push(vin)
        }
      } else if (b.y > TABLE_H - BALL_R) {
        b.y = (TABLE_H - BALL_R) * 2 - b.y
        if (b.vy > 0) {
          const vin = b.vy
          b.vy = -b.vy * WALL_E
          b.vx -= RAIL_SPIN * b.e * vin // 하단 레일: 접선(−x)
          b.e *= 0.5
          ev.cushions.push(i)
          ev.impacts.push(vin)
        }
      }
    }

    // 2) 공-공 충돌 (등질량 탄성 충돌 + 끌어/밀어 반영)
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]
        const c = balls[j]
        const dx = c.x - a.x
        const dy = c.y - a.y
        const minD = BALL_R * 2
        const d2 = dx * dx + dy * dy
        if (d2 >= minD * minD || d2 === 0) continue

        const d = Math.sqrt(d2)
        const nx = dx / d
        const ny = dy / d

        // 겹침 분리
        const overlap = (minD - d) / 2
        a.x -= nx * overlap
        a.y -= ny * overlap
        c.x += nx * overlap
        c.y += ny * overlap

        // 충돌 직전 속도 보관(끌어/밀어 계산용)
        const avx0 = a.vx
        const avy0 = a.vy
        const cvx0 = c.vx
        const cvy0 = c.vy

        // 법선 방향 속도 교환 (접근 중일 때만)
        const van = a.vx * nx + a.vy * ny
        const vcn = c.vx * nx + c.vy * ny
        if (van - vcn <= 0) continue

        const mid = (van + vcn) / 2
        const half = (van - vcn) / 2
        const van2 = mid - BALL_E * half
        const vcn2 = mid + BALL_E * half
        a.vx += (van2 - van) * nx
        a.vy += (van2 - van) * ny
        c.vx += (vcn2 - vcn) * nx
        c.vy += (vcn2 - vcn) * ny

        // 끌어/밀어: 충돌 전 진행 방향으로 수구가 따라가거나 되돌아옴
        applyFollow(a, avx0, avy0)
        applyFollow(c, cvx0, cvy0)

        ev.hits.push([i, j])
        ev.impacts.push(Math.abs(van - vcn))
      }
    }
  }
}
