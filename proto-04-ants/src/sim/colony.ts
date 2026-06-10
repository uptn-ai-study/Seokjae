// 개미 군집 시뮬레이션 — 렌더링과 분리된 순수 로직
// 좌표계는 캔버스 CSS 픽셀 (0..side) 기준.

export type ObstacleType = 'ball' | 'block' | 'leaf' | 'pebble' | 'pinwheel' | 'marble'

export interface Obstacle {
  x: number
  y: number
  r: number // 충돌 반경
  type: ObstacleType
  color: string
  rot: number
  seed: number
}

export interface Ripple {
  x: number
  y: number
  r: number
  max: number
  life: number // 1 → 0
  hue: string
}

type Personality = 'shy' | 'bold' | 'curious'
type State = 'wander' | 'flee' | 'charge' | 'rest'

export interface Ant {
  x: number
  y: number
  angle: number
  speed: number
  baseSpeed: number
  size: number
  personality: Personality
  state: State
  stateT: number
  wanderAngle: number
  wanderTimer: number
  legPhase: number
  restCool: number
  dx: number // 자극 지점 기억
  dy: number
  body: string
  seed: number
}

const ACCENTS = ['#e0584f', '#4a82c4', '#5aa86a', '#eebb45', '#c77dce', '#e8915a']

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 각도 a 에서 목표 t 로 최대 step 만큼 회전
function turnToward(a: number, t: number, step: number): number {
  let d = t - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (Math.abs(d) <= step) return a + d
  return a + Math.sign(d) * step
}

export class Colony {
  side: number
  ants: Ant[] = []
  obstacles: Obstacle[] = []
  ripples: Ripple[] = []
  private margin: number

  constructor(side: number) {
    this.side = side
    this.margin = 14
    this.spawnObstacles()
    this.spawnAnts()
  }

  resize(side: number) {
    const k = side / this.side
    this.side = side
    for (const o of this.obstacles) {
      o.x *= k
      o.y *= k
      o.r *= k
    }
    for (const a of this.ants) {
      a.x *= k
      a.y *= k
    }
  }

  private antCount(): number {
    const c = Math.round((this.side * this.side) / 24000)
    return Math.max(12, Math.min(30, c))
  }

  private spawnObstacles() {
    const s = this.side
    const pool: ObstacleType[] = ['ball', 'block', 'leaf', 'pebble', 'pinwheel', 'marble']
    // 풀을 섞어 4~5개 선택
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const n = Math.random() < 0.5 ? 4 : 5
    const chosen = shuffled.slice(0, n)
    this.obstacles = []
    for (const type of chosen) {
      const r = rand(s * 0.05, s * 0.085)
      let x = 0
      let y = 0
      let ok = false
      for (let tries = 0; tries < 40 && !ok; tries++) {
        x = rand(r + s * 0.08, s - r - s * 0.08)
        y = rand(r + s * 0.12, s - r - s * 0.12)
        ok = true
        for (const o of this.obstacles) {
          if (Math.hypot(o.x - x, o.y - y) < o.r + r + s * 0.06) {
            ok = false
            break
          }
        }
      }
      this.obstacles.push({
        x,
        y,
        r,
        type,
        color: pick(ACCENTS),
        rot: rand(-0.3, 0.3),
        seed: Math.floor(Math.random() * 1e6),
      })
    }
  }

  private freeSpot(size: number): { x: number; y: number } {
    const s = this.side
    for (let i = 0; i < 30; i++) {
      const x = rand(this.margin + size, s - this.margin - size)
      const y = rand(this.margin + size, s - this.margin - size)
      let ok = true
      for (const o of this.obstacles) {
        if (Math.hypot(o.x - x, o.y - y) < o.r + size * 3) {
          ok = false
          break
        }
      }
      if (ok) return { x, y }
    }
    return { x: s / 2, y: s / 2 }
  }

  private spawnAnts() {
    const count = this.antCount()
    this.ants = []
    for (let i = 0; i < count; i++) {
      const size = rand(4.6, 7.2)
      const spot = this.freeSpot(size)
      const personality: Personality =
        Math.random() < 0.55 ? 'shy' : Math.random() < 0.6 ? 'curious' : 'bold'
      const angle = rand(-Math.PI, Math.PI)
      this.ants.push({
        x: spot.x,
        y: spot.y,
        angle,
        speed: 0,
        baseSpeed: rand(14, 26),
        size,
        personality,
        state: 'wander',
        stateT: 0,
        wanderAngle: angle,
        wanderTimer: rand(0.2, 1.6),
        legPhase: rand(0, Math.PI * 2),
        restCool: rand(2, 7),
        dx: 0,
        dy: 0,
        body: pick(['#36332d', '#3d362c', '#2f2c27', '#43352a']),
        seed: Math.floor(Math.random() * 1e6),
      })
    }
  }

  // 화면 터치/클릭 — 자극 지점 중심으로 반응
  disturb(px: number, py: number) {
    const radius = this.side * 0.24
    this.ripples.push({ x: px, y: py, r: 6, max: radius * 1.1, life: 1, hue: '#9a948a' })
    for (const a of this.ants) {
      const d = Math.hypot(a.x - px, a.y - py)
      a.dx = px
      a.dy = py
      if (d < radius) {
        a.restCool = rand(2, 6)
        let react: State
        if (a.personality === 'shy') react = 'flee'
        else if (a.personality === 'bold') react = 'charge'
        else react = d < radius * 0.45 ? 'flee' : 'charge'
        a.state = react
        a.stateT = react === 'flee' ? rand(1.1, 2.2) : rand(0.7, 1.4)
        a.speed = Math.max(a.speed, a.baseSpeed * 1.4)
      } else if (d < radius * 1.7) {
        // 멀리 있는 개미는 잠깐 멈칫
        if (a.state === 'wander') {
          a.state = 'rest'
          a.stateT = rand(0.3, 0.8)
        }
      }
    }
  }

  update(dt: number, t: number) {
    dt = Math.min(dt, 0.05)
    // 잔물결 갱신
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]
      r.life -= dt * 0.9
      r.r += (r.max - r.r) * Math.min(1, dt * 3)
      if (r.life <= 0) this.ripples.splice(i, 1)
    }
    for (const a of this.ants) this.updateAnt(a, dt, t)
  }

  private updateAnt(a: Ant, dt: number, t: number) {
    const s = this.side
    // ── 기본 욕망 벡터 ──
    let vx = 0
    let vy = 0
    let speedTarget = a.baseSpeed
    let maxTurn = 2.4 * dt

    if (a.state === 'rest') {
      a.stateT -= dt
      speedTarget = 0
      if (a.stateT <= 0) {
        a.state = 'wander'
        a.restCool = rand(3, 9)
      }
      vx = Math.cos(a.angle)
      vy = Math.sin(a.angle)
    } else if (a.state === 'flee') {
      a.stateT -= dt
      const nx = a.x - a.dx
      const ny = a.y - a.dy
      const m = Math.hypot(nx, ny) || 1
      vx = nx / m
      vy = ny / m
      speedTarget = a.baseSpeed * 3.1
      maxTurn = 6 * dt
      if (a.stateT <= 0) a.state = 'wander'
    } else if (a.state === 'charge') {
      a.stateT -= dt
      const nx = a.dx - a.x
      const ny = a.dy - a.y
      const m = Math.hypot(nx, ny) || 1
      vx = nx / m
      vy = ny / m
      speedTarget = a.baseSpeed * 2.6
      maxTurn = 5.5 * dt
      if (m < a.size * 4 || a.stateT <= 0) {
        // 도착하면 흠칫 물러서기
        a.state = 'flee'
        a.stateT = rand(0.6, 1.2)
      }
    } else {
      // wander — 천천히 방향을 바꿈
      a.wanderTimer -= dt
      if (a.wanderTimer <= 0) {
        a.wanderTimer = rand(0.5, 1.8)
        a.wanderAngle = a.angle + rand(-1.2, 1.2)
      }
      vx = Math.cos(a.wanderAngle)
      vy = Math.sin(a.wanderAngle)
      // 가끔 쉬어가기
      a.restCool -= dt
      if (a.restCool <= 0 && Math.random() < dt * 0.6) {
        a.state = 'rest'
        a.stateT = rand(0.8, 2.6)
      }
    }

    // ── 회피 벡터 (벽 + 오브제) ──
    const ax = this.avoidVector(a)
    vx += ax.x
    vy += ax.y

    // 욕망 → 목표 각도
    const desired = Math.atan2(vy, vx)
    a.angle = turnToward(a.angle, desired, maxTurn)

    // 속도 가감속
    a.speed += (speedTarget - a.speed) * Math.min(1, dt * 5)

    // 이동
    a.x += Math.cos(a.angle) * a.speed * dt
    a.y += Math.sin(a.angle) * a.speed * dt

    // 경계 하드 클램프
    const m = a.size * 1.6
    if (a.x < m) {
      a.x = m
      a.angle = turnToward(a.angle, 0, 0.6)
    }
    if (a.x > s - m) {
      a.x = s - m
      a.angle = turnToward(a.angle, Math.PI, 0.6)
    }
    if (a.y < m) {
      a.y = m
      a.angle = turnToward(a.angle, Math.PI / 2, 0.6)
    }
    if (a.y > s - m) {
      a.y = s - m
      a.angle = turnToward(a.angle, -Math.PI / 2, 0.6)
    }

    // 다리 애니메이션 — 속도 비례
    a.legPhase += (a.speed * 0.16 + 0.4) * dt * Math.PI
    void t
  }

  // 벽과 오브제로부터의 회피 욕망 (정규화 안 함, 강도 포함)
  private avoidVector(a: Ant): { x: number; y: number } {
    const s = this.side
    let x = 0
    let y = 0
    const pad = 34
    if (a.x < pad) x += (1 - a.x / pad) * 2.4
    if (a.x > s - pad) x -= (1 - (s - a.x) / pad) * 2.4
    if (a.y < pad) y += (1 - a.y / pad) * 2.4
    if (a.y > s - pad) y -= (1 - (s - a.y) / pad) * 2.4

    for (const o of this.obstacles) {
      const dx = a.x - o.x
      const dy = a.y - o.y
      const dist = Math.hypot(dx, dy)
      const reach = o.r + a.size * 2.4
      if (dist < reach && dist > 0.01) {
        const push = (1 - dist / reach) * 2.8
        x += (dx / dist) * push
        y += (dy / dist) * push
      }
    }
    return { x, y }
  }
}
