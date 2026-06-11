<script setup lang="ts">
import { ref, computed } from 'vue'
import Timeline from './components/Timeline.vue'
import { REGIONS, GLOBAL_ERAS } from './data/history'
import type { Region, HEvent } from './data/history'
import { formatSpan, mapsUrl } from './utils'

const timeline = ref<InstanceType<typeof Timeline>>()

// 지역 필터
const activeIds = ref<Set<string>>(new Set(REGIONS.map((r) => r.id)))
const visibleRegions = computed(() => REGIONS.filter((r) => activeIds.value.has(r.id)))
function toggleRegion(id: string) {
  const next = new Set(activeIds.value)
  if (next.has(id)) {
    if (next.size > 1) next.delete(id)
  } else {
    next.add(id)
  }
  activeIds.value = next
}

// 시대 점프
function jumpEra(start: number, end: number) {
  timeline.value?.jumpToRange(start, end)
}

// 상세 시트
const selected = ref<{ region: Region; ev: HEvent } | null>(null)
const sheetOpen = ref(false)
function onSelect(payload: { region: Region; ev: HEvent }) {
  selected.value = payload
  requestAnimationFrame(() => (sheetOpen.value = true))
}
function closeSheet() {
  sheetOpen.value = false
  setTimeout(() => (selected.value = null), 260)
}
const impLabel = (i: number) => (i === 1 ? '핵심 사건' : i === 2 ? '주요 사건' : '상세 사건')

const showHelp = ref(true)
</script>

<template>
  <div class="app">
    <header class="hdr">
      <div class="hdr-top">
        <div class="brand">
          <span class="logo">🗺️</span>
          <div class="brand-txt">
            <h1>타임아틀라스</h1>
            <p>BC 5000 → 2026 · 세계사를 지도처럼 줌하며 탐색</p>
          </div>
        </div>
        <button class="help-btn" @click="showHelp = !showHelp">{{ showHelp ? '✕' : '?' }}</button>
      </div>

      <transition name="fade">
        <div v-if="showHelp" class="help">
          <span>🖱️ 휠 / 핀치로 <b>줌</b></span>
          <span>✋ 드래그로 <b>이동</b></span>
          <span>📍 같은 세로선 = <b>같은 연도</b> (지역 비교)</span>
          <span>🔍 줌인할수록 <b>상세 사건</b>이 나타납니다</span>
          <span>👆 사건을 <b>탭</b>하면 설명</span>
        </div>
      </transition>

      <div class="chips-row">
        <div class="chips era-chips">
          <button class="chip era" @click="timeline?.fit()">전체</button>
          <button
            v-for="e in GLOBAL_ERAS"
            :key="e.name"
            class="chip era"
            @click="jumpEra(e.start, e.end)"
          >{{ e.name }}</button>
        </div>
        <div class="chips region-chips">
          <button
            v-for="r in REGIONS"
            :key="r.id"
            class="chip rg"
            :class="{ active: activeIds.has(r.id) }"
            :style="activeIds.has(r.id) ? { background: r.accent, borderColor: r.accent, color: '#fff' } : { color: r.accent, borderColor: r.accent + '88' }"
            @click="toggleRegion(r.id)"
          >{{ r.emoji }} {{ r.name }}</button>
        </div>
      </div>
    </header>

    <main class="body">
      <Timeline ref="timeline" :regions="visibleRegions" @select="onSelect" />
    </main>

    <!-- 상세 바텀시트 -->
    <div v-if="selected" class="bs-overlay" @click.self="closeSheet">
      <div class="bs-sheet" :class="{ open: sheetOpen }">
        <div class="bs-handle"></div>
        <div class="sheet-body">
          <div class="sheet-meta">
            <span class="sheet-region" :style="{ background: selected.region.accent }">
              {{ selected.region.emoji }} {{ selected.region.name }}
            </span>
            <span class="sheet-imp" :class="'imp' + selected.ev.importance">{{ impLabel(selected.ev.importance) }}</span>
          </div>
          <div class="sheet-year">{{ formatSpan(selected.ev.year, selected.ev.endYear) }}</div>
          <h2 class="sheet-title">{{ selected.ev.title }}</h2>
          <p class="sheet-desc">{{ selected.ev.desc }}</p>
          <a
            v-if="selected.ev.place"
            class="map-link"
            :href="mapsUrl(selected.ev.place)"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="map-link-icon">📍</span>
            <span class="map-link-body">
              <span class="map-link-place">{{ selected.ev.place }}</span>
              <span class="map-link-sub">구글지도에서 보기</span>
            </span>
            <span class="map-link-arrow">↗</span>
          </a>
        </div>
        <button class="btn-primary" @click="closeSheet">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 헤더 */
.hdr {
  flex-shrink: 0;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 10px 14px 8px;
  z-index: 20;
}
.hdr-top { display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 10px; }
.logo { font-size: 26px; }
.brand-txt h1 { font-size: 19px; font-weight: 800; letter-spacing: -0.5px; }
.brand-txt p { font-size: 12px; color: var(--text-2); margin-top: 1px; }
.help-btn {
  width: 32px; height: 32px; border-radius: 9999px;
  border: 1px solid var(--border); background: var(--muted-bg);
  font-size: 14px; font-weight: 700; color: var(--text-2);
}

.help {
  display: flex; flex-wrap: wrap; gap: 6px 14px;
  margin-top: 8px; padding: 8px 12px;
  background: var(--primary-200); border-radius: 10px;
}
.help span { font-size: 12px; color: var(--text-2); }
.help b { color: var(--primary); font-weight: 700; }

.chips-row { margin-top: 9px; display: flex; flex-direction: column; gap: 7px; }
.chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.chips::-webkit-scrollbar { height: 0; }
.chip {
  flex-shrink: 0;
  border-radius: 9999px;
  font-size: 12.5px; font-weight: 600; letter-spacing: -0.3px;
  padding: 5px 12px; background: transparent;
  border: 1.5px solid var(--border); color: var(--text-2);
  white-space: nowrap;
}
.chip.era { border-color: var(--border); color: var(--text-2); }
.chip.era:active { background: var(--muted-bg); }
.chip.rg { border-width: 1.5px; }

/* 본문 */
.body { flex: 1; min-height: 0; position: relative; }

/* 바텀시트 */
.bs-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 200;
}
.bs-sheet {
  width: 100%; max-width: 480px;
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 12px 16px 24px;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 1, 0.55, 1);
}
.bs-sheet.open { transform: translateY(0); }
.bs-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; }
.sheet-body { width: 100%; }
.sheet-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.sheet-region {
  color: #fff; font-size: 12px; font-weight: 700;
  padding: 4px 10px; border-radius: 9999px;
}
.sheet-imp {
  font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px;
  background: var(--muted-bg); color: var(--text-2);
}
.sheet-imp.imp1 { background: var(--primary); color: #fff; }
.sheet-imp.imp2 { background: var(--primary-light); color: var(--primary-dark); }
.sheet-year { font-size: 13px; font-weight: 700; color: var(--primary); letter-spacing: -0.2px; }
.sheet-title { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin-top: 2px; }
.sheet-desc { font-size: 15px; line-height: 1.6; color: var(--text-1); margin-top: 10px; }
.map-link {
  display: flex; align-items: center; gap: 12px;
  margin-top: 14px; padding: 12px 14px;
  background: var(--muted-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-decoration: none;
}
.map-link:active { background: var(--primary-light); border-color: var(--primary); }
.map-link-icon { font-size: 20px; flex-shrink: 0; }
.map-link-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.map-link-place {
  font-size: 14px; font-weight: 700; letter-spacing: -0.2px; color: var(--text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.map-link-sub { font-size: 12px; color: var(--primary); font-weight: 600; }
.map-link-arrow { font-size: 16px; font-weight: 700; color: var(--primary); flex-shrink: 0; }
.btn-primary {
  width: 100%; height: 52px;
  background: var(--primary); color: #fff;
  font-size: 16px; font-weight: 700; letter-spacing: -0.3px;
  border-radius: 12px; border: none;
}
.btn-primary:active { background: var(--primary-dark); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 560px) {
  .brand-txt p { display: none; }
  .brand-txt h1 { font-size: 17px; }
}
</style>
