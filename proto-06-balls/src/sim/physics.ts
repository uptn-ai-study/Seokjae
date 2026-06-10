// 3쿠션 당구 물리 — 저사양 모바일을 위한 경량 구현
// 회전(잉글리시) 없는 순수 구름 모델: 지수 감쇠 마찰 + 등감속, 원-원 탄성 충돌, 쿠션 반사

export const TABLE_W = 500 // 단변(논리 단위) — 모바일 세로 화면에 맞춰 장축을 세로로 둔다
export const TABLE_H = 1000 // 장변
export const BALL_R = 16
export const PAD = 36 // 렌더용 프레임(레일) 두께

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
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

export function allStopped(balls: Ball[]): boolean {
  return balls.every((b) => b.vx === 0 && b.vy === 0)
}

export function stepPhysics(balls: Ball[], dt: number, ev: StepEvents): void {
  let maxV = 0
  for (const b of balls) maxV = Math.max(maxV, Math.hypot(b.vx, b.vy))
  if (maxV === 0) return

  // 가장 빠른 공이 한 서브스텝에 반지름의 절반 이상 이동하지 않도록 분할(터널링 방지)
  const steps = Math.min(8, Math.max(1, Math.ceil((maxV * dt) / (BALL_R * 0.45))))
  const h = dt / steps

  for (let s = 0; s < steps; s++) {
    // 1) 이동 + 마찰 + 쿠션 반사
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i]
      const sp = Math.hypot(b.vx, b.vy)
      if (sp === 0) continue

      const nsp = sp * Math.exp(-FRICTION * h) - DECEL * h
      const f = nsp <= STOP_V ? 0 : nsp / sp
      b.vx *= f
      b.vy *= f
      b.x += b.vx * h
      b.y += b.vy * h

      if (b.x < BALL_R) {
        b.x = BALL_R * 2 - b.x
        if (b.vx < 0) {
          b.vx = -b.vx * WALL_E
          ev.cushions.push(i)
          ev.impacts.push(Math.abs(b.vx))
        }
      } else if (b.x > TABLE_W - BALL_R) {
        b.x = (TABLE_W - BALL_R) * 2 - b.x
        if (b.vx > 0) {
          b.vx = -b.vx * WALL_E
          ev.cushions.push(i)
          ev.impacts.push(Math.abs(b.vx))
        }
      }
      if (b.y < BALL_R) {
        b.y = BALL_R * 2 - b.y
        if (b.vy < 0) {
          b.vy = -b.vy * WALL_E
          ev.cushions.push(i)
          ev.impacts.push(Math.abs(b.vy))
        }
      } else if (b.y > TABLE_H - BALL_R) {
        b.y = (TABLE_H - BALL_R) * 2 - b.y
        if (b.vy > 0) {
          b.vy = -b.vy * WALL_E
          ev.cushions.push(i)
          ev.impacts.push(Math.abs(b.vy))
        }
      }
    }

    // 2) 공-공 충돌 (3개 → 3쌍 고정, 등질량 탄성 충돌)
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

        ev.hits.push([i, j])
        ev.impacts.push(Math.abs(van - vcn))
      }
    }
  }
}
