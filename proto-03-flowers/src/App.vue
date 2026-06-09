<template>
  <div class="app">
    <!-- ── 헤더 ── -->
    <header class="hero">
      <div class="hero-rule">
        <span class="rule-line"></span>
        <span class="rule-dot"></span>
        <span class="rule-line"></span>
      </div>
      <h1 class="hero-title">花鬪占</h1>
      <p class="hero-sub">화투 두 장으로 보는 오늘의 결</p>
      <p class="hero-date">{{ todayLabel }}</p>
    </header>

    <main class="main">
      <button class="btn-draw" @click="draw" :disabled="drawing">
        {{ drawing ? '패를 고르는 중…' : todayFortune ? '다시 뽑기' : '오늘의 패 뽑기' }}
      </button>

      <!-- ── 결과 ── -->
      <transition name="rise">
        <section v-if="todayFortune" class="result">
          <div class="grade">
            <span class="grade-line"></span>
            <span class="grade-title">{{ todayFortune.title }}</span>
            <span class="grade-line"></span>
          </div>

          <div class="cards-row">
            <div class="slot" :class="{ shown: revealed }">
              <HwatuCard :month="todayFortune.a.month" :w="116" />
              <p class="slot-name">{{ nameOf(todayFortune.a.month) }}</p>
              <p class="slot-sub">{{ subjectOf(todayFortune.a.month) }}</p>
            </div>
            <span class="cross">×</span>
            <div class="slot" :class="{ shown: revealed }" style="transition-delay: 0.14s">
              <HwatuCard :month="todayFortune.b.month" :w="116" />
              <p class="slot-name">{{ nameOf(todayFortune.b.month) }}</p>
              <p class="slot-sub">{{ subjectOf(todayFortune.b.month) }}</p>
            </div>
          </div>

          <p class="fortune-body">{{ todayFortune.body }}</p>

          <div class="block">
            <span class="block-label">패 풀이</span>
            <p class="block-text">{{ todayFortune.reason }}</p>
          </div>

          <div class="block tip">
            <span class="block-label">오늘의 한 수</span>
            <p class="block-text">{{ todayFortune.tip }}</p>
          </div>

          <button class="btn-share" @click="share">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {{ copied ? '복사되었습니다' : '이 운세 공유하기' }}
          </button>

          <p v-if="alreadyDrawn" class="redraw-note">
            오늘의 패는 이미 펼쳐졌습니다. 다시 뽑으면 새로운 패를 받을 수 있어요.
          </p>
        </section>
      </transition>

      <!-- ── 빈 상태 ── -->
      <div v-if="!todayFortune" class="empty">
        <div class="empty-cards">
          <HwatuCard back :w="74" />
          <HwatuCard back :w="74" />
        </div>
        <p class="empty-text">버튼을 눌러 오늘의 패 두 장을 펼쳐보세요.</p>
      </div>
    </main>

    <!-- ── 지난 패 ── -->
    <section v-if="past.length" class="history">
      <div class="history-head">
        <h2 class="history-h">지난 패</h2>
        <button class="btn-clear" @click="clearHistory">비우기</button>
      </div>
      <div class="history-list">
        <div v-for="(f, i) in past" :key="i" class="history-item">
          <div class="history-cards">
            <HwatuCard :month="f.a.month" :w="34" />
            <HwatuCard :month="f.b.month" :w="34" />
          </div>
          <div class="history-info">
            <span class="history-grade">{{ f.title }}</span>
            <span class="history-pair">{{ nameOf(f.a.month) }} · {{ nameOf(f.b.month) }}</span>
          </div>
          <span class="history-date">{{ f.date }}</span>
        </div>
      </div>
    </section>

    <footer class="foot">花鬪占 · 오늘 하루의 결을 살피는 작은 점</footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import HwatuCard from './components/HwatuCard.vue'
import { months } from './data/months'
import { buildFortune, type Fortune } from './utils/fortune'

const STORAGE = 'hwatu_v2'

const todayFortune = ref<Fortune | null>(null)
const history = ref<Fortune[]>([])
const drawing = ref(false)
const revealed = ref(false)
const alreadyDrawn = ref(false)
const copied = ref(false)

const todayLabel = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
})

const past = computed(() =>
  todayFortune.value ? history.value.slice(1) : history.value
)

function dayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function nameOf(m: number): string {
  return months[m - 1].name
}
function subjectOf(m: number): string {
  return months[m - 1].subject
}

// 48장(달×4) 덱에서 서로 다른 두 장을 뽑는다
function pickTwo(): [number, number] {
  const a = Math.floor(Math.random() * 48)
  let b = Math.floor(Math.random() * 47)
  if (b >= a) b++
  return [(a % 12) + 1, (b % 12) + 1]
}

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

async function draw() {
  if (drawing.value) return
  drawing.value = true
  revealed.value = false

  await wait(450)

  const [m1, m2] = pickTwo()
  const fortune = buildFortune(months[m1 - 1], months[m2 - 1], todayLabel.value)

  todayFortune.value = fortune
  history.value = [fortune, ...history.value].slice(0, 12)
  alreadyDrawn.value = false
  drawing.value = false
  persist()

  await nextTick()
  requestAnimationFrame(() => (revealed.value = true))
}

function share() {
  const t = todayFortune.value
  if (!t) return
  const text =
    `『화투 운세』 ${t.date}\n` +
    `오늘의 패 · ${t.title}\n` +
    `${nameOf(t.a.month)} × ${nameOf(t.b.month)}\n\n` +
    `${t.body}\n\n` +
    `[패 풀이] ${t.reason}\n` +
    `[오늘의 한 수] ${t.tip}`
  copyText(text)
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function clearHistory() {
  history.value = todayFortune.value ? [todayFortune.value] : []
  persist()
}

function persist() {
  localStorage.setItem(
    STORAGE,
    JSON.stringify({ dayKey: dayKey(), history: history.value })
  )
}

function load() {
  const raw = localStorage.getItem(STORAGE)
  if (!raw) return
  try {
    const data = JSON.parse(raw) as { dayKey: string; history: Fortune[] }
    history.value = Array.isArray(data.history) ? data.history : []
    if (data.dayKey === dayKey() && history.value.length) {
      todayFortune.value = history.value[0]
      alreadyDrawn.value = true
      revealed.value = true
    }
  } catch {
    /* ignore */
  }
}

load()
</script>

<style scoped>
.app {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 0 64px;
  display: flex;
  flex-direction: column;
}

/* ── 헤더 ── */
.hero {
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(201, 168, 76, 0.18), transparent 60%),
    linear-gradient(180deg, #221d27 0%, #1a1620 100%);
  color: #f1e8d6;
  padding: 38px 24px 30px;
  text-align: center;
  border-bottom: 2px solid var(--gold);
  position: relative;
}
.hero-rule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
}
.rule-line {
  width: 46px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold));
}
.rule-line:last-child {
  background: linear-gradient(90deg, var(--gold), transparent);
}
.rule-dot {
  width: 6px;
  height: 6px;
  border: 1px solid var(--gold);
  transform: rotate(45deg);
}
.hero-title {
  font-family: 'Song Myung', 'Nanum Myeongjo', serif;
  font-size: 46px;
  font-weight: 400;
  letter-spacing: 8px;
  color: #f3e7c8;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}
.hero-sub {
  font-family: 'Nanum Myeongjo', serif;
  font-size: 14px;
  color: #c9bda3;
  margin-top: 10px;
  letter-spacing: 1px;
}
.hero-date {
  font-size: 12px;
  color: #8f836c;
  margin-top: 6px;
  letter-spacing: 0.5px;
}

/* ── 본문 ── */
.main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 20px 0;
}

/* ── 뽑기 버튼 ── */
.btn-draw {
  width: 100%;
  height: 56px;
  background: linear-gradient(180deg, #c8202e, #a8121f);
  color: #f7ecd2;
  font-family: 'Nanum Myeongjo', serif;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 4px;
  border: 1px solid var(--gold);
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(168, 18, 31, 0.28);
}
.btn-draw:active:not(:disabled) {
  transform: translateY(1px);
  background: linear-gradient(180deg, #b01a27, #8e0f1a);
}
.btn-draw:disabled {
  opacity: 0.6;
  cursor: default;
}

/* ── 결과 카드 ── */
.result {
  background: var(--paper-card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 22px 18px;
  box-shadow: 0 4px 18px rgba(40, 30, 18, 0.08);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.grade {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.grade-line {
  flex: 1;
  height: 1px;
  background: var(--line);
}
.grade-title {
  font-family: 'Song Myung', 'Nanum Myeongjo', serif;
  font-size: 22px;
  color: var(--vermillion);
  letter-spacing: 3px;
  white-space: nowrap;
}

.cards-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transform: translateY(14px) rotateY(28deg);
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.slot.shown {
  opacity: 1;
  transform: translateY(0) rotateY(0);
}
.slot-name {
  font-family: 'Nanum Myeongjo', serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  margin-top: 4px;
}
.slot-sub {
  font-size: 11px;
  color: var(--ink-3);
}
.cross {
  font-family: 'Song Myung', serif;
  font-size: 18px;
  color: var(--ink-3);
  padding-bottom: 28px;
}

.fortune-body {
  font-family: 'Nanum Myeongjo', serif;
  font-size: 16px;
  line-height: 1.85;
  color: var(--ink);
  text-align: center;
  padding: 4px 2px;
  word-break: keep-all;
}

.block {
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.block-label {
  display: inline-block;
  font-family: 'Nanum Myeongjo', serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--gold-dark);
  letter-spacing: 2px;
  margin-bottom: 7px;
}
.block-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--ink-2);
  word-break: keep-all;
}
.tip .block-text {
  color: var(--ink);
}

/* ── 공유 버튼 ── */
.btn-share {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 48px;
  background: transparent;
  color: var(--ink);
  font-family: 'Nanum Myeongjo', serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  border: 1px solid var(--ink);
  border-radius: 12px;
  cursor: pointer;
  margin-top: 2px;
}
.btn-share:active {
  background: var(--ink);
  color: var(--paper-card);
}

.redraw-note {
  font-size: 12px;
  color: var(--ink-3);
  text-align: center;
  line-height: 1.6;
  word-break: keep-all;
}

/* ── 빈 상태 ── */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 34px 20px 24px;
}
.empty-cards {
  display: flex;
  gap: 12px;
}
.empty-cards :deep(.hwatu):first-child {
  transform: rotate(-7deg);
}
.empty-cards :deep(.hwatu):last-child {
  transform: rotate(7deg);
}
.empty-text {
  font-family: 'Nanum Myeongjo', serif;
  font-size: 14px;
  color: var(--ink-2);
  word-break: keep-all;
  text-align: center;
}

/* ── 지난 패 ── */
.history {
  margin: 28px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.history-h {
  font-family: 'Nanum Myeongjo', serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 2px;
}
.btn-clear {
  background: none;
  border: none;
  font-family: 'Nanum Myeongjo', serif;
  font-size: 13px;
  color: var(--ink-3);
  cursor: pointer;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--paper-card);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.history-cards {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}
.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.history-grade {
  font-family: 'Nanum Myeongjo', serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--vermillion);
}
.history-pair {
  font-size: 12px;
  color: var(--ink-2);
}
.history-date {
  font-size: 11px;
  color: var(--ink-3);
  flex-shrink: 0;
}

.foot {
  text-align: center;
  font-family: 'Nanum Myeongjo', serif;
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.5px;
  margin-top: 36px;
}

/* ── 등장 애니메이션 ── */
.rise-enter-active {
  transition: all 0.4s ease;
}
.rise-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

/* ── 작은 화면 대응 (iPhone SE2 등) ── */
@media (max-width: 360px) {
  .hero-title {
    font-size: 40px;
  }
  .cards-row {
    gap: 6px;
  }
  .fortune-body {
    font-size: 15px;
  }
}
</style>
