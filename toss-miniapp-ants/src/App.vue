<template>
  <div class="app">
    <!-- ── 헤더 / 시계 ── -->
    <header class="topbar">
      <div class="brand">
        <span class="brand-ant">🐜</span>
        <div class="brand-txt">
          <h1 class="brand-title">개미 관찰소</h1>
          <p class="brand-sub">가만히 지켜보세요</p>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-label">지켜본 시간</span>
          <span class="stat-clock">{{ fmt(watchMs) }}</span>
        </div>
        <div class="stat best">
          <span class="stat-label">최고 기록</span>
          <span class="stat-clock">{{ fmt(bestMs) }}</span>
        </div>
      </div>
    </header>

    <!-- ── 샌드박스 ── -->
    <main class="board-wrap" ref="wrapRef">
      <canvas
        ref="canvasRef"
        class="board"
        @pointerdown="onPoke"
      ></canvas>
      <transition name="fade">
        <p v-if="showHint" class="hint">화면을 톡 건드려 보세요</p>
      </transition>
      <transition name="pop">
        <div v-if="toast" class="toast" :class="{ great: toastBest }">{{ toast }}</div>
      </transition>
    </main>

    <!-- ── 하단 ── -->
    <footer class="bottom">
      <button class="btn-record" @click="record">
        <span class="btn-ink">여기까지 볼래요</span>
      </button>
      <p class="foot-note">버튼을 누르면 지금까지 지켜본 시간이 기록돼요</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Colony } from './sim/colony'
import { buildScene, drawAnt, drawRipple } from './sim/draw'

const wrapRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const watchMs = ref(0)
const bestMs = ref(0)
const showHint = ref(true)
const toast = ref('')
const toastBest = ref(false)

let colony: Colony | null = null
let ctx: CanvasRenderingContext2D | null = null
let scene: HTMLCanvasElement | null = null
let trail: HTMLCanvasElement | null = null
let trailCtx: CanvasRenderingContext2D | null = null
let side = 0
let dpr = 1
let raf = 0
let last = 0
let footTick = 0
let toastTimer = 0

const BEST_KEY = 'ant-watch-best'

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function setupCanvas() {
  const wrap = wrapRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  side = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight))
  if (side <= 0) return

  canvas.width = side * dpr
  canvas.height = side * dpr
  canvas.style.width = side + 'px'
  canvas.style.height = side + 'px'
  ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 정적 무대 레이어
  scene = document.createElement('canvas')
  scene.width = side * dpr
  scene.height = side * dpr
  const sctx = scene.getContext('2d')!
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 발자국 흔적 레이어
  trail = document.createElement('canvas')
  trail.width = side * dpr
  trail.height = side * dpr
  trailCtx = trail.getContext('2d')!
  trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

  if (!colony) colony = new Colony(side)
  else colony.resize(side)

  buildScene(sctx, side, colony.obstacles)
}

function onResize() {
  setupCanvas()
}

function onPoke(e: PointerEvent) {
  if (!colony || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (side / rect.width)
  const y = (e.clientY - rect.top) * (side / rect.height)
  colony.disturb(x, y)
  if (showHint.value) showHint.value = false
}

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  if (!ctx || !colony || !scene || !trail || !trailCtx) return
  if (!last) last = now
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05 // 탭 복귀 시 점프 방지
  const t = now / 1000

  watchMs.value += dt * 1000
  colony.update(dt, t)

  // 발자국 흔적: 서서히 옅어지고, 가끔 찍힘
  trailCtx.globalCompositeOperation = 'destination-out'
  trailCtx.fillStyle = 'rgba(0,0,0,0.012)'
  trailCtx.fillRect(0, 0, side, side)
  trailCtx.globalCompositeOperation = 'source-over'
  footTick += dt
  if (footTick > 0.07) {
    footTick = 0
    for (const a of colony.ants) {
      if (a.speed > 6) {
        trailCtx.fillStyle = 'rgba(120,96,56,0.18)'
        trailCtx.beginPath()
        trailCtx.arc(a.x, a.y, a.size * 0.28, 0, Math.PI * 2)
        trailCtx.fill()
      }
    }
  }

  // 합성
  ctx.clearRect(0, 0, side, side)
  ctx.drawImage(scene, 0, 0, side, side)
  ctx.drawImage(trail, 0, 0, side, side)
  for (const r of colony.ripples) drawRipple(ctx, r)
  for (const a of colony.ants) drawAnt(ctx, a, t)
}

function record() {
  const ms = watchMs.value
  let best = false
  if (ms > bestMs.value) {
    bestMs.value = ms
    best = true
    try {
      sessionStorage.setItem(BEST_KEY, String(Math.floor(ms)))
    } catch {
      /* sessionStorage 사용 불가 — 메모리에만 보관 */
    }
    // 새 기록 축하 잔물결
    if (colony) {
      colony.ripples.push({ x: side / 2, y: side / 2, r: 8, max: side * 0.6, life: 1, hue: '#e0584f' })
      colony.ripples.push({ x: side / 2, y: side / 2, r: 8, max: side * 0.4, life: 1, hue: '#eebb45' })
    }
  }
  showToast(
    best
      ? `새 최고 기록!  ${fmt(ms)} 동안 지켜봤어요 🐜`
      : `${fmt(ms)} 동안 지켜봤어요`,
    best,
  )
  watchMs.value = 0
  last = 0
}

function showToast(msg: string, great: boolean) {
  toast.value = msg
  toastBest.value = great
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2600)
}

onMounted(() => {
  const saved = (() => {
    try {
      return sessionStorage.getItem(BEST_KEY)
    } catch {
      return null
    }
  })()
  if (saved) bestMs.value = Number(saved)
  setupCanvas()
  window.addEventListener('resize', onResize)
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>
