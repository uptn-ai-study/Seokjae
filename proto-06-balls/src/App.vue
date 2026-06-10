<template>
  <div ref="rootRef" class="app">
    <div class="scanlines" aria-hidden="true"></div>

    <header class="hud">
      <div class="brand">
        <h1 class="brand-title">NEON CAROM</h1>
        <p class="brand-sub">3쿠션 시뮬레이터</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-num ok">{{ successCount }}</span>
          <span class="stat-label">성공</span>
        </div>
        <div class="stat">
          <span class="stat-num">{{ attemptCount }}</span>
          <span class="stat-label">시도</span>
        </div>
        <div class="stat">
          <span class="stat-num dim">{{ rateText }}</span>
          <span class="stat-label">성공률</span>
        </div>
      </div>
    </header>

    <div class="shot-track">
      <span class="track-chip" :class="{ lit: firstHitIdx !== null }">1적구</span>
      <span class="track-cushions">
        <i v-for="n in 3" :key="n" class="dot" :class="{ lit: cushionCount >= n }"></i>
        <em class="cushion-count">쿠션 {{ cushionCount }}</em>
      </span>
      <span class="track-chip" :class="{ lit: secondHit }">2적구</span>
      <button class="icon-btn" @click="toggleSound">{{ soundOn ? '🔊' : '🔇' }}</button>
    </div>

    <div ref="wrapRef" class="board-wrap" :class="{ glow: fxOn }">
      <canvas
        ref="canvasRef"
        class="board"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
      ></canvas>
      <div v-if="toast" :key="toast.key" class="toast" :class="toast.kind">{{ toast.text }}</div>
      <div v-if="!hasShot && !aiming.active" class="hint">
        화면을 끌어당겼다 놓으면 흰 공이 반대 방향으로 발사돼요
      </div>
    </div>

    <div class="controls">
      <button class="btn-gray" :disabled="!isIdle" @click="resetPositions">배치 초기화</button>
      <button class="btn-primary-md" @click="openSheet">그만하기</button>
    </div>

    <div v-if="sheetOpen" class="bs-overlay" @click.self="closeSheet">
      <div class="bs-sheet" :class="{ open: sheetShown }">
        <div class="bs-handle"></div>
        <div class="bs-header">
          <span class="bs-title">기록 요약</span>
          <button class="bs-close" @click="closeSheet">✕</button>
        </div>
        <div class="result-grid">
          <div class="info-row-card">
            <span class="info-row-label">총 성공</span>
            <span class="info-row-value accent">{{ successCount }}점</span>
          </div>
          <div class="info-row-card">
            <span class="info-row-label">총 시도</span>
            <span class="info-row-value">{{ attemptCount }}회</span>
          </div>
          <div class="info-row-card">
            <span class="info-row-label">성공률</span>
            <span class="info-row-value">{{ rateText }}</span>
          </div>
          <div class="info-row-card">
            <span class="info-row-label">역대 최고 기록</span>
            <span class="info-row-value">{{ best }}점</span>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn-secondary" @click="closeSheet">이어서 치기</button>
          <button class="btn-primary-md" @click="newGame">새 게임 시작</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  BALL_R,
  PAD,
  TABLE_H,
  TABLE_W,
  allStopped,
  stepPhysics,
  type Ball,
  type StepEvents,
} from './sim/physics'

const LW = TABLE_W + PAD * 2
const LH = TABLE_H + PAD * 2
const PULL_MAX = 260 // 최대 당김 길이(논리 단위)
const BEST_KEY = 'neon3c_best'

// ── 반응형 상태 ──
const rootRef = ref<HTMLElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const successCount = ref(0)
const attemptCount = ref(0)
const best = ref(Number(localStorage.getItem(BEST_KEY) ?? 0))
const cushionCount = ref(0)
const firstHitIdx = ref<number | null>(null)
const secondHit = ref(false)
const shotActive = ref(false)
const moving = ref(false)
const hasShot = ref(false)
const soundOn = ref(true)
const sheetOpen = ref(false)
const sheetShown = ref(false)
const fxOn = ref(false)
const toast = ref<{ key: number; kind: 'ok' | 'fail'; text: string } | null>(null)
const aiming = ref({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 })

const rateText = computed(() =>
  attemptCount.value ? Math.round((successCount.value / attemptCount.value) * 100) + '%' : '—',
)
const isIdle = computed(() => !shotActive.value && !moving.value && !sheetOpen.value)

// ── 비반응형 시뮬레이션/렌더 상태 (프레임마다 갱신되므로 ref로 두지 않는다) ──
const balls: Ball[] = [
  { x: 0, y: 0, vx: 0, vy: 0 }, // 0: 수구(흰 공)
  { x: 0, y: 0, vx: 0, vy: 0 }, // 1: 노란 적구
  { x: 0, y: 0, vx: 0, vy: 0 }, // 2: 빨간 적구
]
const trails: { x: number; y: number }[][] = [[], [], []]
const TRAIL_COLORS = ['rgba(0,229,255,1)', 'rgba(255,196,0,1)', 'rgba(255,61,140,1)']

let ctx: CanvasRenderingContext2D | null = null
let bg: HTMLCanvasElement | null = null
let sprites: HTMLCanvasElement[] = []
let k = 1 // 논리 단위 → 캔버스 픽셀 배율
let raf = 0
let needsDraw = true
let lastT = 0
let lastSfx = 0
let ro: ResizeObserver | null = null
let toastTimer = 0
let fxTimer = 0
let ac: AudioContext | null = null

// ── 배치/리셋 ──
function resetPositions() {
  const set = (i: number, x: number, y: number) => {
    balls[i].x = x
    balls[i].y = y
    balls[i].vx = 0
    balls[i].vy = 0
  }
  // 캐롬 초구 배치: 빨간 공은 풋스폿, 노란 공은 헤드스폿, 수구는 그 오른쪽
  set(0, TABLE_W / 2 + 64, TABLE_H * 0.75)
  set(1, TABLE_W / 2, TABLE_H * 0.75)
  set(2, TABLE_W / 2, TABLE_H * 0.25)
  trails.forEach((t) => (t.length = 0))
  cushionCount.value = 0
  firstHitIdx.value = null
  secondHit.value = false
  needsDraw = true
}

// ── 조준/발사 ──
function toLogical(e: PointerEvent) {
  const cv = canvasRef.value!
  const r = cv.getBoundingClientRect()
  return {
    x: ((e.clientX - r.left) / r.width) * LW - PAD,
    y: ((e.clientY - r.top) / r.height) * LH - PAD,
  }
}

function onDown(e: PointerEvent) {
  if (!isIdle.value) return
  const p = toLogical(e)
  aiming.value = { active: true, sx: p.x, sy: p.y, cx: p.x, cy: p.y }
  canvasRef.value?.setPointerCapture(e.pointerId)
  needsDraw = true
}

function onMove(e: PointerEvent) {
  if (!aiming.value.active) return
  const p = toLogical(e)
  aiming.value.cx = p.x
  aiming.value.cy = p.y
  needsDraw = true
}

function onUp() {
  if (!aiming.value.active) return
  const a = aiming.value
  a.active = false
  needsDraw = true
  const dx = a.sx - a.cx
  const dy = a.sy - a.cy
  const len = Math.hypot(dx, dy)
  if (len < 18) return // 너무 짧은 당김은 취소로 간주

  const power = Math.min(1, len / PULL_MAX)
  const sp = 250 + power * 1550
  balls[0].vx = (dx / len) * sp
  balls[0].vy = (dy / len) * sp
  shotActive.value = true
  hasShot.value = true
  firstHitIdx.value = null
  secondHit.value = false
  cushionCount.value = 0
  blip(440, 0.15 + power * 0.2, 0.05, 'square')
}

function onCancel() {
  aiming.value.active = false
  needsDraw = true
}

// ── 3쿠션 판정 ──
// 규칙: 수구가 두 번째 적구에 닿기 전까지 쿠션을 3회 이상 맞아야 성공
function processEvents(ev: StepEvents) {
  let hitHappened = false
  for (const idx of ev.cushions) {
    if (idx === 0 && shotActive.value && !secondHit.value) cushionCount.value++
  }
  for (const [i, j] of ev.hits) {
    hitHappened = true
    if (shotActive.value && (i === 0 || j === 0)) {
      const other = i === 0 ? j : i
      if (firstHitIdx.value === null) firstHitIdx.value = other
      else if (!secondHit.value && other !== firstHitIdx.value) secondHit.value = true
    }
  }
  // 사운드 (50ms 스로틀)
  const now = performance.now()
  if (now - lastSfx > 50 && ev.impacts.length) {
    lastSfx = now
    const vol = Math.min(0.35, Math.max(0, ...ev.impacts) / 2400 + 0.04)
    blip(hitHappened ? 520 : 170, vol, 0.06)
  }
}

function endShot() {
  shotActive.value = false
  attemptCount.value++
  const ok = secondHit.value && cushionCount.value >= 3
  if (ok) {
    successCount.value++
    if (successCount.value > best.value) {
      best.value = successCount.value
      localStorage.setItem(BEST_KEY, String(best.value))
    }
    showToast('ok', `성공! 누적 ${successCount.value}점 · 쿠션 ${cushionCount.value}회`)
    pulseFx()
    playFanfare()
  } else {
    let why = '적구를 맞히지 못했어요'
    if (firstHitIdx.value !== null && !secondHit.value) why = '두 번째 적구를 맞히지 못했어요'
    else if (secondHit.value) why = `쿠션 ${cushionCount.value}회 — 3회가 필요해요`
    showToast('fail', `실패 · ${why}`)
  }
}

// ── 토스트/이펙트 ──
function showToast(kind: 'ok' | 'fail', text: string) {
  toast.value = { key: Date.now(), kind, text }
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 2200)
}

function pulseFx() {
  fxOn.value = true
  clearTimeout(fxTimer)
  fxTimer = window.setTimeout(() => (fxOn.value = false), 900)
}

// ── 사운드 (WebAudio 오실레이터 — 에셋 없이 초경량) ──
function ensureAC(): AudioContext | null {
  if (!ac) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (C) ac = new C()
  }
  if (ac?.state === 'suspended') ac.resume()
  return ac
}

function blip(freq: number, vol: number, dur = 0.07, type: OscillatorType = 'triangle') {
  if (!soundOn.value || vol <= 0) return
  const a = ensureAC()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(Math.min(0.5, vol), a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur)
  o.connect(g).connect(a.destination)
  o.start()
  o.stop(a.currentTime + dur)
}

function playFanfare() {
  blip(660, 0.22, 0.09)
  window.setTimeout(() => blip(880, 0.22, 0.09), 90)
  window.setTimeout(() => blip(1320, 0.26, 0.16), 180)
}

function toggleSound() {
  soundOn.value = !soundOn.value
  if (soundOn.value) blip(660, 0.18, 0.06)
}

// ── 시트/게임 흐름 ──
function openSheet() {
  sheetOpen.value = true
  requestAnimationFrame(() => requestAnimationFrame(() => (sheetShown.value = true)))
}

function closeSheet() {
  sheetShown.value = false
  window.setTimeout(() => (sheetOpen.value = false), 300)
}

function newGame() {
  successCount.value = 0
  attemptCount.value = 0
  hasShot.value = false
  resetPositions()
  closeSheet()
}

// ── 렌더링 ──
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

// 당구대 배경은 오프스크린 캔버스에 1회만 그려두고 매 프레임 drawImage로 복사한다(저사양 핵심)
function renderBackground() {
  const cv = canvasRef.value!
  bg = document.createElement('canvas')
  bg.width = cv.width
  bg.height = cv.height
  const c = bg.getContext('2d')!
  c.setTransform(k, 0, 0, k, 0, 0)

  // 프레임(레일)
  let g = c.createLinearGradient(0, 0, 0, LH)
  g.addColorStop(0, '#262c5c')
  g.addColorStop(1, '#161b40')
  c.fillStyle = g
  rr(c, 0, 0, LW, LH, 18)
  c.fill()
  c.lineWidth = 3
  c.strokeStyle = 'rgba(95,70,255,0.9)'
  rr(c, 1.5, 1.5, LW - 3, LH - 3, 17)
  c.stroke()
  c.lineWidth = 7
  c.strokeStyle = 'rgba(95,70,255,0.18)'
  rr(c, 3.5, 3.5, LW - 7, LH - 7, 16)
  c.stroke()

  // 펠트
  g = c.createLinearGradient(0, PAD, 0, PAD + TABLE_H)
  g.addColorStop(0, '#131a48')
  g.addColorStop(0.5, '#0e1238')
  g.addColorStop(1, '#131a48')
  c.fillStyle = g
  rr(c, PAD, PAD, TABLE_W, TABLE_H, 8)
  c.fill()

  // 그리드
  c.strokeStyle = 'rgba(0,229,255,0.05)'
  c.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    const x = PAD + (TABLE_W * i) / 8
    c.beginPath()
    c.moveTo(x, PAD)
    c.lineTo(x, PAD + TABLE_H)
    c.stroke()
  }
  for (let i = 1; i < 16; i++) {
    const y = PAD + (TABLE_H * i) / 16
    c.beginPath()
    c.moveTo(PAD, y)
    c.lineTo(PAD + TABLE_W, y)
    c.stroke()
  }

  // 쿠션 안쪽 라인
  c.strokeStyle = 'rgba(0,229,255,0.3)'
  c.lineWidth = 1.5
  rr(c, PAD + 1, PAD + 1, TABLE_W - 2, TABLE_H - 2, 7)
  c.stroke()

  // 다이아(사이트) 포인트
  const dia = (x: number, y: number) => {
    c.fillStyle = 'rgba(0,229,255,0.12)'
    c.beginPath()
    c.arc(x, y, 7, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#7de9ff'
    c.beginPath()
    c.moveTo(x, y - 4)
    c.lineTo(x + 4, y)
    c.lineTo(x, y + 4)
    c.lineTo(x - 4, y)
    c.closePath()
    c.fill()
  }
  for (let i = 1; i <= 3; i++) {
    dia(PAD + (TABLE_W * i) / 4, PAD / 2)
    dia(PAD + (TABLE_W * i) / 4, LH - PAD / 2)
  }
  for (let i = 1; i <= 7; i++) {
    dia(PAD / 2, PAD + (TABLE_H * i) / 8)
    dia(LW - PAD / 2, PAD + (TABLE_H * i) / 8)
  }

  // 비네트
  c.save()
  rr(c, PAD, PAD, TABLE_W, TABLE_H, 8)
  c.clip()
  const vg = c.createRadialGradient(LW / 2, LH / 2, TABLE_W * 0.3, LW / 2, LH / 2, TABLE_H * 0.62)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.28)')
  c.fillStyle = vg
  c.fillRect(0, 0, LW, LH)
  c.restore()
}

// 공 스프라이트(글로우 포함)를 미리 구워두고 drawImage만 한다 — 매 프레임 그라디언트 생성 금지
const SPRITE_DEFS = [
  { body: '#f2f4ff', hi: '#ffffff', rim: '#9aa3c8', glow: 'rgba(0,229,255,0.6)' },
  { body: '#ffd93d', hi: '#fff6c9', rim: '#b98a00', glow: 'rgba(255,196,0,0.55)' },
  { body: '#ff4d6d', hi: '#ffc2ce', rim: '#a8173b', glow: 'rgba(255,61,140,0.55)' },
]

function makeSprites() {
  sprites = SPRITE_DEFS.map((d) => {
    const R = BALL_R * k
    const S = Math.max(8, Math.ceil(R * 6))
    const cv = document.createElement('canvas')
    cv.width = S
    cv.height = S
    const c = cv.getContext('2d')!
    const m = S / 2
    let g = c.createRadialGradient(m, m, R * 0.5, m, m, R * 2.6)
    g.addColorStop(0, d.glow)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = g
    c.fillRect(0, 0, S, S)
    g = c.createRadialGradient(m - R * 0.35, m - R * 0.4, R * 0.15, m, m, R)
    g.addColorStop(0, d.hi)
    g.addColorStop(0.55, d.body)
    g.addColorStop(1, d.rim)
    c.fillStyle = g
    c.beginPath()
    c.arc(m, m, R, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.85)'
    c.beginPath()
    c.arc(m - R * 0.4, m - R * 0.45, R * 0.16, 0, Math.PI * 2)
    c.fill()
    return cv
  })
}

// 조준 가이드: 쿠션 반사를 최대 3회까지 미리 보여준다
function castGuide(x: number, y: number, dx: number, dy: number, len: number) {
  const pts = [{ x, y }]
  let px = x
  let py = y
  let vx = dx
  let vy = dy
  let rem = len
  for (let b = 0; b < 3 && rem > 1; b++) {
    let t = rem
    let wall = -1
    if (vx < -1e-6) {
      const tt = (BALL_R - px) / vx
      if (tt > 1e-4 && tt < t) {
        t = tt
        wall = 0
      }
    }
    if (vx > 1e-6) {
      const tt = (TABLE_W - BALL_R - px) / vx
      if (tt > 1e-4 && tt < t) {
        t = tt
        wall = 1
      }
    }
    if (vy < -1e-6) {
      const tt = (BALL_R - py) / vy
      if (tt > 1e-4 && tt < t) {
        t = tt
        wall = 2
      }
    }
    if (vy > 1e-6) {
      const tt = (TABLE_H - BALL_R - py) / vy
      if (tt > 1e-4 && tt < t) {
        t = tt
        wall = 3
      }
    }
    px += vx * t
    py += vy * t
    pts.push({ x: px, y: py })
    rem -= t
    if (wall < 0) break
    if (wall < 2) vx = -vx
    else vy = -vy
  }
  return pts
}

function drawGuide() {
  if (!ctx) return
  const a = aiming.value
  const dx = a.sx - a.cx
  const dy = a.sy - a.cy
  const len = Math.hypot(dx, dy)
  if (len < 4) return
  const power = Math.min(1, len / PULL_MAX)
  const nx = dx / len
  const ny = dy / len
  const cue = balls[0]
  const pts = castGuide(cue.x, cue.y, nx, ny, 260 + power * 600)

  ctx.save()
  ctx.setLineDash([12, 10])
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,229,255,0.85)'
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.setLineDash([])

  // 당김 방향 표시
  ctx.strokeStyle = 'rgba(255,61,190,0.5)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cue.x, cue.y)
  ctx.lineTo(cue.x - nx * Math.min(len, PULL_MAX) * 0.6, cue.y - ny * Math.min(len, PULL_MAX) * 0.6)
  ctx.stroke()

  // 파워 링
  ctx.strokeStyle = power > 0.85 ? '#ff3dbe' : '#00e5ff'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cue.x, cue.y, BALL_R + 10, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function draw() {
  if (!ctx) return
  const cv = canvasRef.value!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cv.width, cv.height)
  if (bg) ctx.drawImage(bg, 0, 0)

  // 테이블 좌표계로 전환
  ctx.setTransform(k, 0, 0, k, PAD * k, PAD * k)

  // 궤적
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const t = trails[i]
    if (t.length < 2) continue
    ctx.strokeStyle = TRAIL_COLORS[i]
    for (let s = 1; s < t.length; s++) {
      ctx.globalAlpha = (s / t.length) * 0.22
      ctx.lineWidth = BALL_R * 1.2 * (s / t.length)
      ctx.beginPath()
      ctx.moveTo(t[s - 1].x, t[s - 1].y)
      ctx.lineTo(t[s].x, t[s].y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (aiming.value.active) drawGuide()

  // 공 (미리 구운 스프라이트를 디바이스 픽셀 좌표로)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (let i = 0; i < 3; i++) {
    const s = sprites[i]
    if (!s) continue
    ctx.drawImage(s, (balls[i].x + PAD) * k - s.width / 2, (balls[i].y + PAD) * k - s.height / 2)
  }
}

// ── 메인 루프: 멈춰 있고 조준도 안 하면 그리기를 건너뛴다(배터리/저사양 배려) ──
function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.033, (now - lastT) / 1000 || 0.016)
  lastT = now

  const ev: StepEvents = { cushions: [], hits: [], impacts: [] }
  stepPhysics(balls, dt, ev)
  if (ev.cushions.length || ev.hits.length) processEvents(ev)

  const stopped = allStopped(balls)
  if (!stopped) {
    for (let i = 0; i < 3; i++) {
      const b = balls[i]
      const t = trails[i]
      if (Math.hypot(b.vx, b.vy) > 40) {
        t.push({ x: b.x, y: b.y })
        if (t.length > 12) t.shift()
      } else if (t.length) {
        t.shift()
      }
    }
  } else if (trails.some((t) => t.length)) {
    trails.forEach((t) => (t.length = 0))
    needsDraw = true
  }

  if (shotActive.value && stopped) endShot()
  moving.value = !stopped

  if (!stopped || aiming.value.active || needsDraw) {
    draw()
    needsDraw = false
  }
}

// ── 리사이즈 ──
function resize() {
  const wrap = wrapRef.value
  const cv = canvasRef.value
  if (!wrap || !cv) return
  const rect = wrap.getBoundingClientRect()
  if (rect.width < 10 || rect.height < 10) return
  const w = Math.min(rect.width, (rect.height * LW) / LH)
  const h = (w * LH) / LW
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  cv.style.width = `${w}px`
  cv.style.height = `${h}px`
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)
  k = cv.width / LW
  renderBackground()
  makeSprites()
  needsDraw = true
}

// ── 모바일 더블탭 확대 / 핀치 차단 ──
const blockGesture = (e: Event) => e.preventDefault()

onMounted(() => {
  const cv = canvasRef.value
  if (!cv) return
  ctx = cv.getContext('2d')
  resetPositions()
  ro = new ResizeObserver(resize)
  if (wrapRef.value) ro.observe(wrapRef.value)
  resize()

  cv.addEventListener('touchstart', blockGesture, { passive: false })
  cv.addEventListener('touchend', blockGesture, { passive: false })
  rootRef.value?.addEventListener('dblclick', blockGesture)
  rootRef.value?.addEventListener('gesturestart', blockGesture)

  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  clearTimeout(toastTimer)
  clearTimeout(fxTimer)
  const cv = canvasRef.value
  cv?.removeEventListener('touchstart', blockGesture)
  cv?.removeEventListener('touchend', blockGesture)
  rootRef.value?.removeEventListener('dblclick', blockGesture)
  rootRef.value?.removeEventListener('gesturestart', blockGesture)
  ac?.close()
})
</script>
