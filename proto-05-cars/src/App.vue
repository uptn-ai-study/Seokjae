<template>
  <div
    class="game-root"
    ref="rootRef"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerleave="onUp"
  >
    <canvas ref="canvasRef" class="board"></canvas>

    <!-- 좌/우 조작 화살표 -->
    <div class="touch-zones" ref="zonesRef">
      <div class="touch-zone" :class="{ lit: steer === -1 }"><span class="zone-arrow">◀</span></div>
      <div class="touch-zone" :class="{ lit: steer === 1 }"><span class="zone-arrow">▶</span></div>
    </div>

    <!-- HUD -->
    <div class="hud" v-if="state !== 'ready'">
      <div class="hud-box">
        <div class="hud-label">TIME</div>
        <div class="hud-time">{{ fmt(elapsedMs) }}</div>
        <div class="hud-collide">🫧 구조 {{ collisions }}</div>
      </div>
      <div class="hud-box best">
        <div class="hud-label">BEST</div>
        <div class="hud-time">{{ fmt(bestMs) }}</div>
      </div>
    </div>

    <!-- 멈춤 버튼 -->
    <div class="bottom" v-if="state === 'run'">
      <button class="btn-stop" @click.stop="stop">여기서 멈출래</button>
    </div>

    <!-- 시작 화면 -->
    <div class="overlay" v-if="state === 'ready'">
      <div class="title-badge">ROUTE 7 · 1986</div>
      <h1 class="title-main">7번국도<br />로맨스</h1>
      <p class="title-sub">
        바다를 오른쪽에 두고, 둘이서 끝없는 해안도로를.<br />
        화면 <b>왼쪽·오른쪽</b>을 눌러 핸들을 꺾어요.<br />
        오리·고라니·바위를 만나면 비눗방울로 살며시 옮겨줄게요. 🫧
      </p>
      <div class="title-best" v-if="bestMs > 0">BEST {{ fmt(bestMs) }}</div>
      <button class="btn-go" @click.stop="start">▶ 출 발</button>
      <p class="hint-drive">지칠 때까지, 멈추지 않아도 괜찮아요</p>
    </div>

    <!-- 결과 화면 -->
    <div class="overlay" v-if="state === 'ended'">
      <div class="title-badge">DRIVE COMPLETE</div>
      <div class="result-time">{{ fmt(elapsedMs) }}</div>
      <div class="result-new" v-if="isNewBest">★ NEW BEST RECORD ★</div>
      <div class="result-row">
        <div class="result-cell">
          <div class="rc-label">BEST</div>
          <div class="rc-val">{{ fmt(bestMs) }}</div>
        </div>
        <div class="result-cell">
          <div class="rc-label">RESCUED</div>
          <div class="rc-val">🫧 {{ collisions }}</div>
        </div>
      </div>
      <button class="btn-go" @click.stop="start">↺ 다시 달리기</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Game } from './sim/game'
import { renderScene } from './sim/draw'

const BEST_KEY = 'route7_best_ms'

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const zonesRef = ref<HTMLElement | null>(null)

const state = ref<'ready' | 'run' | 'ended'>('ready')
const elapsedMs = ref(0)
const collisions = ref(0)
const steer = ref(0)
const bestMs = ref(0)
const isNewBest = ref(false)

const game = new Game()
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let last = 0
let dpr = 1
let cssW = 0
let cssH = 0
let bestSaved = 0

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function resize() {
  const cv = canvasRef.value
  const root = rootRef.value
  if (!cv || !root) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  cssW = root.clientWidth
  cssH = root.clientHeight
  cv.width = Math.round(cssW * dpr)
  cv.height = Math.round(cssH * dpr)
}

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  if (!ctx) return
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
  last = now

  game.update(dt)

  // 실시간 최고기록 갱신
  if (game.state === 'run' && game.elapsedMs > bestSaved) {
    bestSaved = game.elapsedMs
    bestMs.value = bestSaved
    isNewBest.value = true
    localStorage.setItem(BEST_KEY, String(Math.floor(bestSaved)))
  }

  // 반응형 상태 미러링
  elapsedMs.value = game.elapsedMs
  collisions.value = game.collisions
  steer.value = game.steer

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  renderScene(ctx, game, cssW, cssH, now)
}

function start() {
  isNewBest.value = false
  bestSaved = bestMs.value
  game.start()
  state.value = 'run'
}

function stop() {
  game.stop()
  state.value = 'ended'
}

// ── 입력: 화면 좌/우 ──
function sideFromEvent(e: PointerEvent): number {
  const root = rootRef.value
  if (!root) return 0
  const rect = root.getBoundingClientRect()
  return e.clientX - rect.left < rect.width / 2 ? -1 : 1
}
let pointerDown = false
function onDown(e: PointerEvent) {
  if (state.value !== 'run') return
  pointerDown = true
  game.setSteer(sideFromEvent(e))
}
function onMove(e: PointerEvent) {
  if (!pointerDown || state.value !== 'run') return
  game.setSteer(sideFromEvent(e))
}
function onUp() {
  pointerDown = false
  game.setSteer(0)
}

// ── 키보드(데스크톱 테스트) ──
function onKey(e: KeyboardEvent, down: boolean) {
  if (state.value !== 'run') return
  if (e.key === 'ArrowLeft') game.setSteer(down ? -1 : 0)
  if (e.key === 'ArrowRight') game.setSteer(down ? 1 : 0)
}
const keyDown = (e: KeyboardEvent) => onKey(e, true)
const keyUp = (e: KeyboardEvent) => onKey(e, false)

// ── 모바일 더블탭 확대 / 핀치 차단 (조작 영역 한정) ──
// 같은 자리를 연속으로 두드려 핸들을 꺾을 때 브라우저가 화면을 확대하지 않도록
// 조작 영역의 touchstart 기본동작과 더블탭/핀치 제스처를 막는다.
// 포인터 이벤트(조향)는 그대로 발생하며, 버튼 클릭에는 영향이 없다.
const blockGesture = (e: Event) => e.preventDefault()

onMounted(() => {
  const cv = canvasRef.value
  if (!cv) return
  ctx = cv.getContext('2d')
  resize()
  game.reset()
  bestMs.value = Number(localStorage.getItem(BEST_KEY) || 0)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)

  // 조작 영역: 더블탭 확대를 유발하는 touchstart 기본동작 차단
  zonesRef.value?.addEventListener('touchstart', blockGesture, { passive: false })
  zonesRef.value?.addEventListener('touchend', blockGesture, { passive: false })
  // iOS Safari 핀치/더블탭 제스처 + 더블클릭 확대 차단
  rootRef.value?.addEventListener('dblclick', blockGesture, { passive: false })
  rootRef.value?.addEventListener('gesturestart', blockGesture, { passive: false })

  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', keyDown)
  window.removeEventListener('keyup', keyUp)
  zonesRef.value?.removeEventListener('touchstart', blockGesture)
  zonesRef.value?.removeEventListener('touchend', blockGesture)
  rootRef.value?.removeEventListener('dblclick', blockGesture)
  rootRef.value?.removeEventListener('gesturestart', blockGesture)
})
</script>
