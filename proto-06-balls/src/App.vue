<template>
  <div ref="rootRef" class="app">
    <div class="scanlines" aria-hidden="true"></div>

    <!-- ── 모드 선택 화면 ── -->
    <div v-if="screen === 'menu'" class="menu">
      <div class="menu-top">
        <h1 class="brand-title big">NEON CAROM</h1>
        <p class="menu-sub">레트로 퓨처리즘 당구 시뮬레이터 · 모드를 골라주세요</p>
      </div>
      <div class="mode-cards">
        <button class="mode-card three" @click="startGame('3c')">
          <span class="mode-emoji">🎯</span>
          <span class="mode-name">3쿠션</span>
          <span class="mode-balls"><i class="mb white"></i><i class="mb yellow"></i><i class="mb red"></i></span>
          <span class="mode-desc">수구로 두 적구를 모두 맞히되,<br />두 번째 적구 전에 쿠션 3번 이상</span>
          <span class="mode-go">선택 ▸</span>
        </button>
        <button class="mode-card four" @click="startGame('4b')">
          <span class="mode-emoji">🟥</span>
          <span class="mode-name">4구</span>
          <span class="mode-balls"><i class="mb white"></i><i class="mb yellow"></i><i class="mb red"></i><i class="mb red"></i></span>
          <span class="mode-desc">수구로 빨간 공 2개를 맞히면 득점.<br />노란 공을 맞히면 실격</span>
          <span class="mode-go">선택 ▸</span>
        </button>
      </div>
      <p class="menu-foot">최고 기록 · 3쿠션 {{ best3c }}점 · 4구 {{ best4b }}점</p>
    </div>

    <!-- ── 게임 화면 ── -->
    <header class="hud">
      <div class="brand">
        <h1 class="brand-title">NEON CAROM</h1>
        <p class="brand-sub">{{ mode === '3c' ? '3쿠션' : '4구' }} 시뮬레이터</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-num ok">{{ successCount }}</span>
          <span class="stat-label">점수</span>
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
      <template v-if="mode === '3c'">
        <span class="track-chip" :class="{ lit: firstHitIdx !== null }">1적구</span>
        <span class="track-cushions">
          <i v-for="n in 3" :key="n" class="dot" :class="{ lit: cushionCount >= n }"></i>
          <em class="cushion-count">쿠션 {{ cushionCount }}</em>
        </span>
        <span class="track-chip" :class="{ lit: secondHit }">2적구</span>
      </template>
      <template v-else>
        <span class="track-chip red" :class="{ lit: r1Hit }">빨강 1</span>
        <span class="track-chip red" :class="{ lit: r2Hit }">빨강 2</span>
        <span class="track-chip warn" :class="{ danger: foulYellow }">
          노랑 {{ foulYellow ? '실격' : '회피' }}
        </span>
      </template>
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

    <!-- ── 회전(당점) 설정 ── -->
    <div class="tools">
      <div
        ref="padRef"
        class="spin-pad"
        @pointerdown="padDown"
        @pointermove="padMove"
        @pointerup="padUp"
        @pointercancel="padUp"
      >
        <span class="pad-line h"></span>
        <span class="pad-line v"></span>
        <span class="pad-dot" :style="dotStyle"></span>
      </div>
      <div class="spin-info">
        <div class="spin-title">당점 · 회전</div>
        <div class="spin-desc">{{ spinLabel }}</div>
        <button class="spin-reset" @click="resetSpin">중앙(무회전)</button>
      </div>
    </div>

    <div class="controls">
      <button class="btn-gray" :disabled="!isIdle" @click="resetPositions">배치 초기화</button>
      <button class="btn-primary-md" @click="openSheet">그만하기</button>
    </div>

    <!-- ── 기록 요약 시트 ── -->
    <div v-if="sheetOpen" class="bs-overlay" @click.self="closeSheet">
      <div class="bs-sheet" :class="{ open: sheetShown }">
        <div class="bs-handle"></div>
        <div class="bs-header">
          <span class="bs-title">{{ mode === '3c' ? '3쿠션' : '4구' }} 기록</span>
          <button class="bs-close" @click="closeSheet">✕</button>
        </div>
        <div class="result-grid">
          <div class="info-row-card">
            <span class="info-row-label">누적 점수</span>
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
            <span class="info-row-label">{{ mode === '3c' ? '3쿠션' : '4구' }} 최고 기록</span>
            <span class="info-row-value">{{ mode === '3c' ? best3c : best4b }}점</span>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn-secondary" @click="closeSheet">이어서 치기</button>
          <button class="btn-primary-md" @click="goMenu">메뉴로 나가기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  BALL_R,
  PAD,
  TABLE_H,
  TABLE_W,
  allStopped,
  makeBall,
  stepPhysics,
  type Ball,
  type StepEvents,
} from './sim/physics'

type Mode = '3c' | '4b'

const LW = TABLE_W + PAD * 2
const LH = TABLE_H + PAD * 2
const PULL_MAX = 260 // 최대 당김 길이(논리 단위)
const BEST_KEY = { '3c': 'neon_best_3c', '4b': 'neon_best_4b' }

// ── 반응형 상태 ──
const rootRef = ref<HTMLElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const padRef = ref<HTMLElement | null>(null)

const screen = ref<'menu' | 'play'>('menu')
const mode = ref<Mode>('3c')

const successCount = ref(0)
const attemptCount = ref(0)
const best3c = ref(Number(localStorage.getItem(BEST_KEY['3c']) ?? 0))
const best4b = ref(Number(localStorage.getItem(BEST_KEY['4b']) ?? 0))

// 3쿠션 판정
const cushionCount = ref(0)
const firstHitIdx = ref<number | null>(null)
const secondHit = ref(false)
// 4구 판정
const r1Hit = ref(false)
const r2Hit = ref(false)
const foulYellow = ref(false)

const shotActive = ref(false)
const moving = ref(false)
const hasShot = ref(false)
const soundOn = ref(true)
const sheetOpen = ref(false)
const sheetShown = ref(false)
const fxOn = ref(false)
const toast = ref<{ key: number; kind: 'ok' | 'fail'; text: string } | null>(null)
const aiming = ref({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 })

// 당점/회전: x = 좌우(우 +), y = 상하(위=밀어/따라 +), 단위원 내 [-1,1]
const tip = reactive({ x: 0, y: 0 })

const rateText = computed(() =>
  attemptCount.value ? Math.round((successCount.value / attemptCount.value) * 100) + '%' : '—',
)
const isIdle = computed(
  () => screen.value === 'play' && !shotActive.value && !moving.value && !sheetOpen.value,
)

const dotStyle = computed(() => ({
  left: `${50 + tip.x * 42}%`,
  top: `${50 - tip.y * 42}%`,
}))

const spinLabel = computed(() => {
  const mag = Math.hypot(tip.x, tip.y)
  if (mag < 0.12) return '중앙 — 무회전'
  const parts: string[] = []
  if (tip.y > 0.25) parts.push('밀어치기')
  else if (tip.y < -0.25) parts.push('끌어치기')
  if (tip.x > 0.25) parts.push('오른 회전')
  else if (tip.x < -0.25) parts.push('왼 회전')
  return parts.length ? parts.join(' · ') : '약한 회전'
})

// ── 비반응형 시뮬레이션/렌더 상태 ──
let balls: Ball[] = []
let trails: { x: number; y: number }[][] = []
let ballRoles: ('white' | 'yellow' | 'red')[] = []

const PALETTE = {
  white: { body: '#f2f4ff', hi: '#ffffff', rim: '#9aa3c8', glow: 'rgba(0,229,255,0.6)', trail: 'rgba(0,229,255,1)' },
  yellow: { body: '#ffd93d', hi: '#fff6c9', rim: '#b98a00', glow: 'rgba(255,196,0,0.55)', trail: 'rgba(255,196,0,1)' },
  red: { body: '#ff4d6d', hi: '#ffc2ce', rim: '#a8173b', glow: 'rgba(255,61,140,0.55)', trail: 'rgba(255,61,140,1)' },
}

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
let padActive = false

// ── 모드/배치 ──
function buildForMode(m: Mode) {
  ballRoles = m === '3c' ? ['white', 'yellow', 'red'] : ['white', 'yellow', 'red', 'red']
  balls = ballRoles.map(() => makeBall(0, 0))
  trails = ballRoles.map(() => [])
}

function resetFlags() {
  cushionCount.value = 0
  firstHitIdx.value = null
  secondHit.value = false
  r1Hit.value = false
  r2Hit.value = false
  foulYellow.value = false
}

function resetPositions() {
  const set = (i: number, x: number, y: number) => {
    balls[i].x = x
    balls[i].y = y
    balls[i].vx = 0
    balls[i].vy = 0
    balls[i].e = 0
    balls[i].f = 0
  }
  if (mode.value === '3c') {
    set(0, TABLE_W / 2 + 64, TABLE_H * 0.75) // 수구(흰)
    set(1, TABLE_W / 2, TABLE_H * 0.75) // 노란 적구
    set(2, TABLE_W / 2, TABLE_H * 0.25) // 빨간 적구
  } else {
    set(0, TABLE_W / 2 + 70, TABLE_H * 0.8) // 수구(흰)
    set(1, TABLE_W / 2 - 70, TABLE_H * 0.8) // 노란 공(맞히면 실격)
    set(2, TABLE_W / 2, TABLE_H * 0.24) // 빨간 1
    set(3, TABLE_W / 2, TABLE_H * 0.52) // 빨간 2
  }
  trails.forEach((t) => (t.length = 0))
  resetFlags()
  needsDraw = true
}

function startGame(m: Mode) {
  mode.value = m
  successCount.value = 0
  attemptCount.value = 0
  hasShot.value = false
  buildForMode(m)
  resetPositions()
  screen.value = 'play'
  // 다음 프레임에 레이아웃 확정 후 캔버스/스프라이트 재계산
  requestAnimationFrame(() => resize())
}

function goMenu() {
  closeSheet()
  screen.value = 'menu'
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
  const cue = balls[0]
  cue.vx = (dx / len) * sp
  cue.vy = (dy / len) * sp
  cue.e = tip.x // 옆회전(우 +)
  cue.f = tip.y // 밀어(+)/끌어(−)
  shotActive.value = true
  hasShot.value = true
  resetFlags()
  blip(440, 0.15 + power * 0.2, 0.05, 'square')
}

function onCancel() {
  aiming.value.active = false
  needsDraw = true
}

// ── 회전 패드 ──
function padApply(e: PointerEvent) {
  const el = padRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  let nx = ((e.clientX - r.left) / r.width - 0.5) * 2
  let ny = ((e.clientY - r.top) / r.height - 0.5) * 2
  ny = -ny // 화면 위쪽 = 밀어치기(+)
  const m = Math.hypot(nx, ny)
  const max = 0.92
  if (m > max) {
    nx = (nx / m) * max
    ny = (ny / m) * max
  }
  tip.x = nx
  tip.y = ny
  needsDraw = true
}

function padDown(e: PointerEvent) {
  padActive = true
  padRef.value?.setPointerCapture(e.pointerId)
  padApply(e)
}

function padMove(e: PointerEvent) {
  if (padActive) padApply(e)
}

function padUp() {
  padActive = false
}

function resetSpin() {
  tip.x = 0
  tip.y = 0
  needsDraw = true
}

// ── 판정 ──
function processEvents(ev: StepEvents) {
  if (mode.value === '3c') {
    for (const idx of ev.cushions) {
      if (idx === 0 && shotActive.value && !secondHit.value) cushionCount.value++
    }
  }
  let hitHappened = false
  for (const [i, j] of ev.hits) {
    hitHappened = true
    if (!shotActive.value || (i !== 0 && j !== 0)) continue
    const other = i === 0 ? j : i
    if (mode.value === '3c') {
      if (firstHitIdx.value === null) firstHitIdx.value = other
      else if (!secondHit.value && other !== firstHitIdx.value) secondHit.value = true
    } else {
      if (other === 1) foulYellow.value = true
      else if (other === 2) r1Hit.value = true
      else if (other === 3) r2Hit.value = true
    }
  }
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
  let ok = false
  let msg = ''
  if (mode.value === '3c') {
    ok = secondHit.value && cushionCount.value >= 3
    if (ok) msg = `성공! 누적 ${successCount.value + 1}점 · 쿠션 ${cushionCount.value}회`
    else if (firstHitIdx.value === null) msg = '적구를 맞히지 못했어요'
    else if (!secondHit.value) msg = '두 번째 적구를 맞히지 못했어요'
    else msg = `쿠션 ${cushionCount.value}회 — 3회가 필요해요`
  } else {
    const reds = (r1Hit.value ? 1 : 0) + (r2Hit.value ? 1 : 0)
    ok = reds >= 2 && !foulYellow.value
    if (ok) msg = `득점! 누적 ${successCount.value + 1}점`
    else if (foulYellow.value) msg = '노란 공을 맞혀 실격'
    else msg = `빨간 공 ${reds}/2 — 둘 다 맞혀야 해요`
  }
  if (ok) {
    successCount.value++
    updateBest()
    showToast('ok', msg)
    pulseFx()
    playFanfare()
  } else {
    showToast('fail', '실패 · ' + msg)
  }
}

function updateBest() {
  if (mode.value === '3c') {
    if (successCount.value > best3c.value) {
      best3c.value = successCount.value
      localStorage.setItem(BEST_KEY['3c'], String(best3c.value))
    }
  } else if (successCount.value > best4b.value) {
    best4b.value = successCount.value
    localStorage.setItem(BEST_KEY['4b'], String(best4b.value))
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
    const C =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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

// ── 시트 ──
function openSheet() {
  sheetOpen.value = true
  requestAnimationFrame(() => requestAnimationFrame(() => (sheetShown.value = true)))
}

function closeSheet() {
  sheetShown.value = false
  window.setTimeout(() => (sheetOpen.value = false), 300)
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

  g = c.createLinearGradient(0, PAD, 0, PAD + TABLE_H)
  g.addColorStop(0, '#131a48')
  g.addColorStop(0.5, '#0e1238')
  g.addColorStop(1, '#131a48')
  c.fillStyle = g
  rr(c, PAD, PAD, TABLE_W, TABLE_H, 8)
  c.fill()

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

  c.strokeStyle = 'rgba(0,229,255,0.3)'
  c.lineWidth = 1.5
  rr(c, PAD + 1, PAD + 1, TABLE_W - 2, TABLE_H - 2, 7)
  c.stroke()

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
function makeSprites() {
  sprites = ballRoles.map((role) => {
    const d = PALETTE[role]
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

// 조준 가이드: 쿠션 반사를 최대 3회까지 미리 보여준다(기하학적 직선 — 회전 곡구는 미반영)
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

  ctx.strokeStyle = 'rgba(255,61,190,0.5)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cue.x, cue.y)
  ctx.lineTo(cue.x - nx * Math.min(len, PULL_MAX) * 0.6, cue.y - ny * Math.min(len, PULL_MAX) * 0.6)
  ctx.stroke()

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

  ctx.setTransform(k, 0, 0, k, PAD * k, PAD * k)

  // 궤적
  ctx.lineCap = 'round'
  for (let i = 0; i < balls.length; i++) {
    const t = trails[i]
    if (t.length < 2) continue
    ctx.strokeStyle = PALETTE[ballRoles[i]].trail
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

  // 공 스프라이트 (디바이스 픽셀 좌표)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (let i = 0; i < balls.length; i++) {
    const s = sprites[i]
    if (!s) continue
    ctx.drawImage(s, (balls[i].x + PAD) * k - s.width / 2, (balls[i].y + PAD) * k - s.height / 2)
  }

  // 수구 당점 표시 (정지 시)
  if (!moving.value && balls.length) {
    const cu = balls[0]
    const mx = (cu.x + PAD) * k + tip.x * BALL_R * 0.55 * k
    const my = (cu.y + PAD) * k - tip.y * BALL_R * 0.55 * k
    ctx.fillStyle = 'rgba(15,16,40,0.92)'
    ctx.beginPath()
    ctx.arc(mx, my, BALL_R * 0.24 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ff3dbe'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

// ── 메인 루프: 멈춰 있고 조준도 안 하면 그리기를 건너뛴다 ──
function frame(now: number) {
  raf = requestAnimationFrame(frame)
  if (screen.value !== 'play' || !balls.length) {
    lastT = now
    return
  }
  const dt = Math.min(0.033, (now - lastT) / 1000 || 0.016)
  lastT = now

  const ev: StepEvents = { cushions: [], hits: [], impacts: [] }
  stepPhysics(balls, dt, ev)
  if (ev.cushions.length || ev.hits.length) processEvents(ev)

  const stopped = allStopped(balls)
  if (!stopped) {
    for (let i = 0; i < balls.length; i++) {
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
  buildForMode(mode.value)
  resetPositions()
  ro = new ResizeObserver(() => resize())
  if (wrapRef.value) ro.observe(wrapRef.value)
  resize()

  cv.addEventListener('touchstart', blockGesture, { passive: false })
  cv.addEventListener('touchend', blockGesture, { passive: false })
  padRef.value?.addEventListener('touchstart', blockGesture, { passive: false })
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
  padRef.value?.removeEventListener('touchstart', blockGesture)
  rootRef.value?.removeEventListener('dblclick', blockGesture)
  rootRef.value?.removeEventListener('gesturestart', blockGesture)
  ac?.close()
})
</script>
