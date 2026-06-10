// ============================================================================
// 7번국도 로맨스 — Out Run 스타일 의사(疑似) 3D 드라이빙 엔진
// 충돌은 사고가 아니라 "비눗방울 구조"로 표현되며, 게임은 끝나지 않고
// 사용자가 멈출 때까지 계속 달린다. 달린 시간이 최고기록으로 저장된다.
// ============================================================================

// ── 월드 / 카메라 상수 ──────────────────────────────────────────────────────
export const SEG = 200 // 한 도로 세그먼트의 길이(월드 단위)
export const ROAD_W = 2200 // 도로 반폭(월드 단위)
export const RUMBLE_LEN = 4 // 갓길 줄무늬 묶음 길이(세그먼트 수)
export const DRAW_DIST = 240 // 그릴 세그먼트 수
export const CAMERA_HEIGHT = 1100
const FOV = 100
export const CAMERA_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180)
export const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH // 카메라~차 거리

// ── 주행 파라미터 (너무 어렵지 않게, 부드럽게) ──────────────────────────────
const MAX_SPEED = SEG * 55 // 이론상 최고 속도(월드/초)
const CRUISE = MAX_SPEED * 0.72 // 평상시 순항 속도
const ACCEL = MAX_SPEED * 0.55 // 가속도
const OFFROAD_LIMIT = MAX_SPEED * 0.42 // 갓길/바다로 벗어났을 때 제한
const CENTRIFUGAL = 0.26 // 커브에서 바깥으로 밀리는 정도
const COLLIDE_W = 0.34 // 충돌 판정 폭(도로 좌표 기준)

// ── 타입 ────────────────────────────────────────────────────────────────────
export interface PNode {
  worldX: number
  worldY: number
  worldZ: number
  camX: number
  camY: number
  camZ: number
  scrX: number
  scrY: number
  scrW: number
  scrScale: number
}

export type ObstacleKind = 'duck' | 'deer' | 'rock'
export interface Obstacle {
  kind: ObstacleKind
  offset: number // 도로 가로 위치 -1..1
  rescued: boolean
}

export type SceneryKind = 'cherry' | 'lighthouse' | 'sail' | 'buoy' | 'cliff'
export interface Scenery {
  kind: SceneryKind
  offset: number // |offset|>1 → 도로 바깥(좌:육지 / 우:바다)
}

export interface Segment {
  index: number
  curve: number
  p1: PNode
  p2: PNode
  obstacles: Obstacle[]
  scenery: Scenery[]
}

export interface Bubble {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  maxLife: number
  kind: ObstacleKind
}

// ── 보조 함수 ────────────────────────────────────────────────────────────────
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function newNode(): PNode {
  return {
    worldX: 0, worldY: 0, worldZ: 0,
    camX: 0, camY: 0, camZ: 0,
    scrX: 0, scrY: 0, scrW: 0, scrScale: 0,
  }
}

// 끝없이 이어지는 부드러운 커브 / 언덕 (i = 세그먼트 인덱스)
const curveAt = (i: number) =>
  4 * (0.55 * Math.sin(i * 0.010) + 0.45 * Math.sin(i * 0.021 + 2.2))
const hillAt = (i: number) =>
  1300 * Math.sin(i * 0.0055) + 650 * Math.sin(i * 0.013 + 1)

// ── 3D → 2D 투영 ─────────────────────────────────────────────────────────────
export function project(
  p: PNode,
  camX: number, camY: number, camZ: number,
  depth: number, w: number, h: number, roadW: number,
) {
  p.camX = p.worldX - camX
  p.camY = p.worldY - camY
  p.camZ = p.worldZ - camZ
  const scale = depth / (p.camZ || 0.0001)
  p.scrScale = scale
  p.scrX = Math.round(w / 2 + (scale * p.camX * w) / 2)
  p.scrY = Math.round(h / 2 - (scale * p.camY * h) / 2)
  p.scrW = Math.round((scale * roadW * w) / 2)
}

export type GameState = 'ready' | 'run' | 'ended'

export class Game {
  segments: Segment[] = []
  baseIndex = 0

  position = 0
  speed = 0
  playerX = 0 // -1..1 (도로 중앙=0, ±1=갓길)
  steer = 0 // -1 좌 / 0 / 1 우
  lean = 0 // 차체 기울임(연출)

  elapsedMs = 0
  collisions = 0
  shake = 0

  bubbles: Bubble[] = []
  state: GameState = 'ready'

  private lastObsIdx = -999
  private obsGap = 90

  reset() {
    this.segments = []
    this.baseIndex = 0
    this.position = 0
    this.speed = 0
    this.playerX = 0
    this.steer = 0
    this.lean = 0
    this.elapsedMs = 0
    this.collisions = 0
    this.shake = 0
    this.bubbles = []
    this.lastObsIdx = -999
    this.obsGap = 90
    this.ensure(DRAW_DIST + 4)
  }

  start() {
    this.reset()
    this.state = 'run'
  }

  stop() {
    this.state = 'ended'
  }

  // ── 세그먼트 관리 (무한 생성 + 뒤쪽 정리) ─────────────────────────────────
  segmentAt(index: number): Segment {
    this.ensure(index)
    return this.segments[index - this.baseIndex]
  }

  private ensure(index: number) {
    while (this.baseIndex + this.segments.length - 1 < index) {
      const i = this.baseIndex + this.segments.length
      this.segments.push(this.generate(i))
    }
  }

  private prune() {
    const minKeep = Math.floor(this.position / SEG) - 8
    while (this.baseIndex < minKeep && this.segments.length > 0) {
      this.segments.shift()
      this.baseIndex++
    }
  }

  private generate(i: number): Segment {
    const p1 = newNode()
    const p2 = newNode()
    p1.worldZ = i * SEG
    p2.worldZ = (i + 1) * SEG
    p1.worldY = hillAt(i)
    p2.worldY = hillAt(i + 1)

    const seg: Segment = {
      index: i,
      curve: curveAt(i),
      p1, p2,
      obstacles: [],
      scenery: [],
    }

    // ── 풍경(결정적 배치) ──
    // 좌측 육지: 야자수 / 절벽, 우측 바다: 돛단배 / 부표
    if (i % 7 === 0) seg.scenery.push({ kind: 'cherry', offset: -1.55 - Math.random() * 1.1 })
    if (i % 29 === 11) seg.scenery.push({ kind: 'lighthouse', offset: -3.0 })
    if (i % 19 === 6) seg.scenery.push({ kind: 'cliff', offset: -2.6 - Math.random() })
    if (i % 12 === 4) seg.scenery.push({ kind: 'sail', offset: 2.2 + Math.random() * 2.4 })
    if (i % 8 === 3) seg.scenery.push({ kind: 'buoy', offset: 1.45 + Math.random() * 0.5 })

    // ── 장애물 (출발 직후 안전구간 이후, 충분한 간격) ──
    if (i > 110 && i - this.lastObsIdx >= this.obsGap) {
      this.lastObsIdx = i
      this.obsGap = 70 + Math.floor(Math.random() * 90) // 70~160 세그먼트 간격
      const r = Math.random()
      const kind: ObstacleKind = r < 0.45 ? 'duck' : r < 0.72 ? 'rock' : 'deer'
      const offset = Math.random() * 1.2 - 0.6 // -0.6..0.6
      seg.obstacles.push({ kind, offset, rescued: false })
    }

    return seg
  }

  // ── 입력 ──────────────────────────────────────────────────────────────────
  setSteer(dir: number) {
    this.steer = dir
  }

  // ── 매 프레임 갱신 ───────────────────────────────────────────────────────
  update(dt: number) {
    if (this.state !== 'run') {
      this.updateBubbles(dt)
      this.shake = Math.max(0, this.shake - dt * 3)
      return
    }

    this.elapsedMs += dt * 1000

    const offRoad = Math.abs(this.playerX) > 1
    if (offRoad) {
      // 갓길/모래밭/바다 가장자리 → 부드럽게 감속
      this.speed = Math.max(OFFROAD_LIMIT, this.speed - ACCEL * 1.6 * dt)
    } else {
      this.speed = Math.min(CRUISE, this.speed + ACCEL * dt)
    }

    this.position += this.speed * dt
    this.prune()
    this.ensure(Math.floor(this.position / SEG) + DRAW_DIST + 4)

    const speedPct = this.speed / MAX_SPEED
    const seg = this.segmentAt(Math.floor(this.position / SEG))
    const dx = dt * 2.1 * Math.max(0.25, speedPct)

    if (this.steer < 0) this.playerX -= dx
    if (this.steer > 0) this.playerX += dx
    // 커브 원심력
    this.playerX -= dx * speedPct * seg.curve * CENTRIFUGAL
    this.playerX = clamp(this.playerX, -2.1, 2.1)

    // 차체 기울임 연출
    const targetLean = this.steer * 0.6 + seg.curve * 0.12
    this.lean = lerp(this.lean, targetLean, Math.min(1, dt * 8))

    this.checkCollision()
    this.updateBubbles(dt)
    this.shake = Math.max(0, this.shake - dt * 3)
  }

  private checkCollision() {
    const pIdx = Math.floor((this.position + PLAYER_Z) / SEG)
    for (let i = pIdx - 1; i <= pIdx + 1; i++) {
      const s = this.segmentAt(i)
      for (const o of s.obstacles) {
        if (o.rescued) continue
        if (Math.abs(o.offset - this.playerX) < COLLIDE_W) {
          o.rescued = true
          this.collisions++
          this.speed *= 0.6 // 살짝 느려짐(곧 회복)
          this.shake = 1
          this.spawnBubble(o)
        }
      }
    }
  }

  private spawnBubble(o: Obstacle) {
    // 충돌은 화면 하단부에서 발생 → 그 위치에서 비눗방울이 떠오른다
    const side = o.offset >= this.playerX ? 1 : -1
    this.bubbles.push({
      x: 0.5 + o.offset * 0.18, // 정규화 좌표(0..1) — 그릴 때 화면폭 곱함
      y: 0.74,
      vx: side * 0.06,
      vy: -0.22,
      r: 0.07,
      life: 2.2,
      maxLife: 2.2,
      kind: o.kind,
    })
  }

  private updateBubbles(dt: number) {
    for (const b of this.bubbles) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vy += 0.02 * dt // 살짝 감속하며 둥실
      b.life -= dt
    }
    this.bubbles = this.bubbles.filter((b) => b.life > 0)
  }
}
