<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import type { Region, HEvent } from '../data/history'
import { YEAR_MIN, YEAR_MAX, GLOBAL_ERAS } from '../data/history'
import { formatYearShort, clamp } from '../utils'

const props = defineProps<{ regions: Region[] }>()
const emit = defineEmits<{ select: [payload: { region: Region; ev: HEvent }] }>()

// ── 레이아웃 상수
const RULER_H = 58
const LANE_H = 140
const PERIOD_TOP = 6
const PERIOD_H = 19
const ZOOM_MAX = 16
const MAX_LABEL_ROWS = 4
const TICK_MIN_PX = 72

const totalYears = YEAR_MAX - YEAR_MIN

// ── DOM refs
const mainEl = ref<HTMLElement>()
const wrapEl = ref<HTMLElement>()

// ── 상태
const pxPerYear = ref(0.1)
const viewportW = ref(1000)
const scrollLeft = ref(0)
const scrollTop = ref(0)
const cursorLocalX = ref(-1)
const hoverYear = ref<number | null>(null)
const labelW = ref(132)

const contentW = computed(() => Math.max(viewportW.value, totalYears * pxPerYear.value))
const contentH = computed(() => props.regions.length * LANE_H)
const zoomMin = computed(() => viewportW.value / totalYears)
const zoomPct = computed(() => Math.round((pxPerYear.value / zoomMin.value) * 100))

// LOD: 줌 레벨에 따라 노출할 사건 중요도 임계값
const minImportance = computed(() => {
  if (pxPerYear.value >= 1.0) return 3
  if (pxPerYear.value >= 0.24) return 2
  return 1
})

function xOf(year: number) {
  return (year - YEAR_MIN) * pxPerYear.value
}
function yearAt(contentX: number) {
  return Math.round(YEAR_MIN + contentX / pxPerYear.value)
}

// ── 눈금자 틱
const TICK_STEPS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000]
const tickStep = computed(() => {
  for (const s of TICK_STEPS) {
    if (s * pxPerYear.value >= TICK_MIN_PX) return s
  }
  return 2000
})
const ticks = computed(() => {
  const step = tickStep.value
  const start = Math.ceil(YEAR_MIN / step) * step
  const out: { year: number; x: number }[] = []
  for (let y = start; y <= YEAR_MAX; y += step) {
    out.push({ year: y, x: xOf(y) })
  }
  return out
})

// ── 전 지구적 시대 밴드 (눈금자 상단 + 배경)
const eraBands = computed(() =>
  GLOBAL_ERAS.map((e, i) => ({
    name: e.name,
    left: xOf(e.start),
    width: xOf(e.end) - xOf(e.start),
    odd: i % 2 === 1,
  }))
)

// 클램프된 시대/시대구분 라벨 위치(스크롤해도 보이도록)
function clampedLabelLeft(left: number, width: number, estW: number) {
  const vpLeft = scrollLeft.value + 6
  let l = Math.max(left + 8, vpLeft)
  if (l + estW > left + width - 6) l = Math.max(left + 8, left + width - estW - 6)
  return l
}

// ── 레인별 사건 마커 + 라벨 스태킹
interface Marker {
  ev: HEvent
  x: number
  r: number
  row: number // -1 = 라벨 없음(점만)
  labelLeft: number
  labelTop: number
  connTop: number
  connH: number
}
const baselineY = LANE_H - 16

const laneMarkers = computed(() => {
  const thr = minImportance.value
  return props.regions.map((region) => {
    const evs = region.events
      .filter((e) => e.importance <= thr)
      .slice()
      .sort((a, b) => a.year - b.year)
    const rowRight: number[] = []
    const markers: Marker[] = []
    for (const ev of evs) {
      const x = xOf(ev.year)
      const r = ev.importance === 1 ? 6 : ev.importance === 2 ? 5 : 4
      const estW = ev.title.length * 12 + 18
      let row = -1
      for (let i = 0; i < MAX_LABEL_ROWS; i++) {
        if (x - 8 > (rowRight[i] ?? -Infinity)) {
          rowRight[i] = x + estW
          row = i
          break
        }
      }
      const labelTop = baselineY - 12 - (row + 1) * 20
      markers.push({
        ev,
        x,
        r,
        row,
        labelLeft: x,
        labelTop,
        connTop: labelTop + 17,
        connH: baselineY - (labelTop + 17),
      })
    }
    return { region, markers }
  })
})

// ── 줌
async function applyZoom(newPx: number, anchorClientX: number) {
  const el = mainEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const localX = anchorClientX - rect.left
  const contentX = el.scrollLeft + localX
  const year = YEAR_MIN + contentX / pxPerYear.value
  pxPerYear.value = clamp(newPx, zoomMin.value, ZOOM_MAX)
  await nextTick()
  const newContentX = (year - YEAR_MIN) * pxPerYear.value
  el.scrollLeft = newContentX - localX
  onScroll()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18
  applyZoom(pxPerYear.value * factor, e.clientX)
}

function zoomBy(factor: number) {
  const el = mainEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  applyZoom(pxPerYear.value * factor, rect.left + rect.width / 2)
}

function fit() {
  const el = mainEl.value
  if (!el) return
  pxPerYear.value = zoomMin.value
  nextTick(() => {
    el.scrollLeft = 0
    onScroll()
  })
}

async function jumpToRange(start: number, end: number) {
  const el = mainEl.value
  if (!el) return
  const span = Math.max(end - start, 40)
  const target = clamp((viewportW.value * 0.74) / span, zoomMin.value, ZOOM_MAX)
  pxPerYear.value = target
  await nextTick()
  const centerYear = (start + end) / 2
  const contentX = (centerYear - YEAR_MIN) * target
  el.scrollLeft = contentX - viewportW.value / 2
  onScroll()
}

defineExpose({ jumpToRange, fit, zoomBy })

// ── 포인터 팬 / 핀치
const pointers = new Map<number, { x: number; y: number }>()
let lastPanX = 0
let lastPanY = 0
let lastDist = 0
let dragged = false

function onPointerDown(e: PointerEvent) {
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) {
    lastPanX = e.clientX
    lastPanY = e.clientY
    dragged = false
  } else if (pointers.size === 2) {
    const pts = [...pointers.values()]
    lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }
}

function onPointerMove(e: PointerEvent) {
  const el = mainEl.value
  if (!el) return
  // 가이드라인
  const rect = el.getBoundingClientRect()
  cursorLocalX.value = e.clientX - rect.left
  hoverYear.value = yearAt(el.scrollLeft + cursorLocalX.value)

  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (pointers.size >= 2) {
    const pts = [...pointers.values()]
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    if (lastDist > 0) {
      const midX = (pts[0].x + pts[1].x) / 2
      applyZoom(pxPerYear.value * (dist / lastDist), midX)
    }
    lastDist = dist
  } else if (pointers.size === 1) {
    const dx = e.clientX - lastPanX
    const dy = e.clientY - lastPanY
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true
    el.scrollLeft -= dx
    el.scrollTop -= dy
    lastPanX = e.clientX
    lastPanY = e.clientY
    onScroll()
  }
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) lastDist = 0
}

function onLeave() {
  cursorLocalX.value = -1
  hoverYear.value = null
}

function onMarkerClick(region: Region, ev: HEvent) {
  if (dragged) return
  emit('select', { region, ev })
}

// ── 스크롤 동기화
function onScroll() {
  const el = mainEl.value
  if (!el) return
  scrollLeft.value = el.scrollLeft
  scrollTop.value = el.scrollTop
}

// ── 미니맵
const miniW = computed(() => viewportW.value)
const miniViewLeft = computed(() => (scrollLeft.value / contentW.value) * miniW.value)
const miniViewW = computed(() =>
  Math.max(14, ((mainEl.value?.clientWidth ?? viewportW.value) / contentW.value) * miniW.value)
)
const miniEras = computed(() =>
  GLOBAL_ERAS.map((e, i) => ({
    name: e.name,
    left: ((e.start - YEAR_MIN) / totalYears) * miniW.value,
    width: ((e.end - e.start) / totalYears) * miniW.value,
    odd: i % 2 === 1,
  }))
)
function miniSeek(e: PointerEvent) {
  const el = mainEl.value
  const mini = e.currentTarget as HTMLElement
  if (!el) return
  const rect = mini.getBoundingClientRect()
  const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1)
  const centerContentX = frac * contentW.value
  el.scrollLeft = centerContentX - el.clientWidth / 2
  onScroll()
}
let miniDragging = false
function miniDown(e: PointerEvent) {
  miniDragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  miniSeek(e)
}
function miniMove(e: PointerEvent) {
  if (miniDragging) miniSeek(e)
}
function miniUp() {
  miniDragging = false
}

// ── 리사이즈
let ro: ResizeObserver | null = null
function measure() {
  const el = mainEl.value
  if (!el) return
  viewportW.value = el.clientWidth
  labelW.value = window.innerWidth < 560 ? 96 : 132
  if (pxPerYear.value < zoomMin.value) pxPerYear.value = zoomMin.value
}

onMounted(() => {
  measure()
  pxPerYear.value = zoomMin.value
  mainEl.value?.addEventListener('wheel', onWheel, { passive: false })
  ro = new ResizeObserver(() => measure())
  if (mainEl.value) ro.observe(mainEl.value)
  nextTick(onScroll)
})
onBeforeUnmount(() => {
  mainEl.value?.removeEventListener('wheel', onWheel)
  ro?.disconnect()
})

// 지역 필터가 바뀌면 스크롤 보정
watch(
  () => props.regions.length,
  () => nextTick(onScroll)
)
</script>

<template>
  <div class="timeline">
    <!-- 헤더 그리드: 코너 / 눈금자 / 라벨 / 캔버스 -->
    <div class="grid" :style="{ gridTemplateColumns: labelW + 'px 1fr', gridTemplateRows: RULER_H + 'px 1fr' }">
      <!-- 코너 -->
      <div class="corner">
        <span class="corner-zoom">{{ zoomPct }}%</span>
      </div>

      <!-- 눈금자 -->
      <div class="ruler-vp">
        <div class="ruler-inner" :style="{ width: contentW + 'px', transform: `translateX(${-scrollLeft}px)` }">
          <!-- 시대 밴드 라벨 -->
          <div class="ruler-eras">
            <div
              v-for="band in eraBands"
              :key="band.name"
              class="era-seg"
              :class="{ odd: band.odd }"
              :style="{ left: band.left + 'px', width: band.width + 'px' }"
            >
              <span class="era-label" :style="{ left: clampedLabelLeft(band.left, band.width, band.name.length * 13 + 8) - band.left + 'px' }">
                {{ band.name }}
              </span>
            </div>
          </div>
          <!-- 틱 -->
          <div class="ruler-ticks">
            <div v-for="t in ticks" :key="t.year" class="tick" :style="{ left: t.x + 'px' }">
              <span class="tick-label">{{ formatYearShort(t.year) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 지역 라벨 -->
      <div class="labels-vp">
        <div class="labels-inner" :style="{ height: contentH + 'px', transform: `translateY(${-scrollTop}px)` }">
          <div
            v-for="(region, i) in regions"
            :key="region.id"
            class="lane-label"
            :class="{ alt: i % 2 === 1 }"
            :style="{ height: LANE_H + 'px' }"
          >
            <span class="ll-emoji">{{ region.emoji }}</span>
            <span class="ll-name" :style="{ color: region.accent }">{{ region.name }}</span>
          </div>
        </div>
      </div>

      <!-- 캔버스 -->
      <div class="canvas-wrap" ref="wrapEl">
        <div
          class="main scroll-thin"
          ref="mainEl"
          @scroll="onScroll"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @pointerleave="onLeave"
        >
          <div class="content" :style="{ width: contentW + 'px', height: contentH + 'px' }">
            <!-- 시대 배경 밴드 -->
            <div
              v-for="band in eraBands"
              :key="'bg' + band.name"
              class="era-bg"
              :class="{ odd: band.odd }"
              :style="{ left: band.left + 'px', width: band.width + 'px' }"
            />
            <!-- 세로 그리드 -->
            <div v-for="t in ticks" :key="'g' + t.year" class="gridline" :style="{ left: t.x + 'px' }" />

            <!-- 레인 -->
            <div
              v-for="(lane, i) in laneMarkers"
              :key="lane.region.id"
              class="lane"
              :class="{ alt: i % 2 === 1 }"
              :style="{ top: i * LANE_H + 'px', height: LANE_H + 'px' }"
            >
              <!-- 시대구분 바 -->
              <div
                v-for="p in lane.region.periods"
                :key="p.name"
                class="period"
                :style="{
                  left: xOf(p.start) + 'px',
                  width: Math.max(2, xOf(p.end) - xOf(p.start)) + 'px',
                  top: PERIOD_TOP + 'px',
                  height: PERIOD_H + 'px',
                  background: lane.region.accent + '22',
                  borderColor: lane.region.accent + '55',
                }"
              >
                <span
                  class="period-label"
                  :style="{
                    left: clampedLabelLeft(xOf(p.start), Math.max(2, xOf(p.end) - xOf(p.start)), p.name.length * 12 + 6) - xOf(p.start) + 'px',
                    color: lane.region.accent,
                  }"
                >{{ p.name }}</span>
              </div>

              <!-- 마커 베이스라인 -->
              <div class="baseline" :style="{ top: baselineY + 'px' }" />

              <!-- 사건 -->
              <template v-for="m in lane.markers" :key="m.ev.title + m.ev.year">
                <div
                  v-if="m.row >= 0"
                  class="conn"
                  :style="{ left: m.x + 'px', top: m.connTop + 'px', height: m.connH + 'px', background: lane.region.accent + '66' }"
                />
                <button
                  class="marker"
                  :class="'imp' + m.ev.importance"
                  :style="{
                    left: m.x + 'px',
                    top: baselineY + 'px',
                    width: m.r * 2 + 'px',
                    height: m.r * 2 + 'px',
                    background: lane.region.accent,
                    boxShadow: m.ev.importance === 1 ? `0 0 0 3px ${lane.region.accent}33` : 'none',
                  }"
                  @click.stop="onMarkerClick(lane.region, m.ev)"
                  :title="m.ev.title"
                />
                <button
                  v-if="m.row >= 0"
                  class="ev-label"
                  :style="{ left: m.labelLeft + 'px', top: m.labelTop + 'px' }"
                  @click.stop="onMarkerClick(lane.region, m.ev)"
                >{{ m.ev.title }}</button>
              </template>
            </div>
          </div>
        </div>

        <!-- 가이드라인 오버레이 -->
        <div class="overlay" v-show="cursorLocalX >= 0">
          <div class="guide" :style="{ left: cursorLocalX + 'px' }" />
          <div class="guide-year" :style="{ left: cursorLocalX + 'px' }" v-if="hoverYear !== null">
            {{ formatYearShort(hoverYear) }}
          </div>
        </div>

        <!-- 줌 컨트롤 -->
        <div class="zoom-ctrl">
          <button @click="zoomBy(1.4)" title="확대">＋</button>
          <button @click="zoomBy(1 / 1.4)" title="축소">－</button>
          <button class="fit" @click="fit" title="전체 보기">⤢</button>
        </div>
      </div>
    </div>

    <!-- 미니맵 -->
    <div class="minimap-row" :style="{ gridTemplateColumns: labelW + 'px 1fr' }">
      <div class="mini-corner">전체</div>
      <div
        class="mini"
        @pointerdown="miniDown"
        @pointermove="miniMove"
        @pointerup="miniUp"
        @pointercancel="miniUp"
      >
        <div
          v-for="e in miniEras"
          :key="'m' + e.name"
          class="mini-era"
          :class="{ odd: e.odd }"
          :style="{ left: e.left + 'px', width: e.width + 'px' }"
        >
          <span>{{ e.name }}</span>
        </div>
        <div class="mini-view" :style="{ left: miniViewLeft + 'px', width: miniViewW + 'px' }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--canvas);
}
.grid {
  flex: 1;
  display: grid;
  min-height: 0;
}

/* 코너 */
.corner {
  background: var(--ruler-bg);
  border-right: 1px solid var(--canvas-line-strong);
  border-bottom: 1px solid var(--canvas-line-strong);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
}
.corner-zoom {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: -0.2px;
}

/* 눈금자 */
.ruler-vp {
  overflow: hidden;
  background: var(--ruler-bg);
  border-bottom: 1px solid var(--canvas-line-strong);
  position: relative;
}
.ruler-inner { position: relative; height: 100%; }
.ruler-eras { position: absolute; top: 0; left: 0; right: 0; height: 28px; }
.era-seg {
  position: absolute;
  top: 0;
  height: 28px;
  border-right: 1px solid var(--canvas-line-strong);
  overflow: hidden;
}
.era-seg.odd { background: rgba(95, 70, 255, 0.04); }
.era-label {
  position: absolute;
  top: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  letter-spacing: -0.3px;
}
.ruler-ticks { position: absolute; top: 28px; left: 0; right: 0; bottom: 0; }
.tick { position: absolute; top: 0; height: 30px; border-left: 1px solid var(--canvas-line-strong); }
.tick-label {
  position: absolute;
  left: 5px;
  top: 7px;
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  font-weight: 500;
}

/* 지역 라벨 */
.labels-vp {
  overflow: hidden;
  background: var(--ruler-bg);
  border-right: 1px solid var(--canvas-line-strong);
}
.labels-inner { position: relative; }
.lane-label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  padding: 0 10px;
  border-bottom: 1px solid var(--canvas-line);
}
.lane-label.alt { background: rgba(0, 0, 0, 0.015); }
.ll-emoji { font-size: 19px; }
.ll-name { font-size: 13px; font-weight: 700; letter-spacing: -0.3px; }

/* 캔버스 */
.canvas-wrap { position: relative; overflow: hidden; }
.main {
  position: absolute;
  inset: 0;
  overflow: auto;
  cursor: grab;
  touch-action: none;
  background: var(--canvas);
}
.main:active { cursor: grabbing; }
.content { position: relative; }

.era-bg { position: absolute; top: 0; bottom: 0; }
.era-bg.odd { background: rgba(95, 70, 255, 0.025); }
.gridline { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--canvas-line); }

.lane { position: absolute; left: 0; right: 0; border-bottom: 1px solid var(--canvas-line); }
.lane.alt { background: rgba(0, 0, 0, 0.012); }

.period {
  position: absolute;
  border: 1px solid;
  border-radius: 6px;
  overflow: hidden;
}
.period-label {
  position: absolute;
  top: 2px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: -0.3px;
  pointer-events: none;
}

.baseline {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--canvas-line-strong);
}

.conn { position: absolute; width: 1px; transform: translateX(-0.5px); }

.marker {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1.5px solid #fff;
  padding: 0;
  cursor: pointer;
  z-index: 2;
}
.marker.imp1 { border-width: 2px; }

.ev-label {
  position: absolute;
  transform: translateX(-50%);
  max-width: 168px;
  padding: 2px 7px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--canvas-line-strong);
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  z-index: 3;
}
.ev-label:active { background: var(--primary-light); }

/* 오버레이 */
.overlay { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.guide { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(95, 70, 255, 0.45); }
.guide-year {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  white-space: nowrap;
}

/* 줌 컨트롤 */
.zoom-ctrl {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 6;
}
.zoom-ctrl button {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.95);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.zoom-ctrl button:active { background: var(--primary-light); }
.zoom-ctrl .fit { font-size: 16px; color: var(--primary); }

/* 미니맵 */
.minimap-row {
  display: grid;
  height: 46px;
  border-top: 1px solid var(--canvas-line-strong);
  background: var(--ruler-bg);
  flex-shrink: 0;
}
.mini-corner {
  border-right: 1px solid var(--canvas-line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
}
.mini { position: relative; overflow: hidden; cursor: pointer; }
.mini-era {
  position: absolute;
  top: 0;
  bottom: 0;
  border-right: 1px solid var(--canvas-line);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.mini-era.odd { background: rgba(95, 70, 255, 0.05); }
.mini-era span {
  font-size: 9.5px;
  color: var(--text-3);
  white-space: nowrap;
  font-weight: 600;
  padding: 0 2px;
}
.mini-view {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: rgba(95, 70, 255, 0.14);
  border: 1.5px solid var(--primary);
  border-radius: 5px;
}
</style>
