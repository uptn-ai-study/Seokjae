<template>
  <div class="app">
    <header class="header">
      <h1 class="display">🎱 로또 번호 생성기</h1>
      <p class="caption-1">행운의 번호를 뽑아보세요</p>
    </header>

    <main class="main">
      <!-- 게임 수 선택 -->
      <div class="card section-card">
        <p class="body-2 label">생성 게임 수</p>
        <div class="chip-row">
          <button
            v-for="n in [1, 3, 5]"
            :key="n"
            :class="['chip', { active: gameCount === n }]"
            @click="gameCount = n"
          >
            {{ n }}게임
          </button>
        </div>
      </div>

      <!-- 생성 버튼 -->
      <button class="btn-primary" @click="generate" :disabled="isAnimating">
        {{ isAnimating ? '추첨 중...' : '번호 생성하기' }}
      </button>

      <!-- 결과 -->
      <transition-group name="slide-up" tag="div" class="results">
        <div v-for="(game, idx) in games" :key="game.id" class="card game-card">
          <div class="game-header">
            <span class="badge-primary">{{ idx + 1 }}게임</span>
            <span class="caption-1">합계 {{ sum(game.numbers) }}</span>
          </div>
          <div class="balls">
            <div
              v-for="(num, ni) in game.numbers"
              :key="ni"
              :class="['ball', ballColor(num), { 'ball-appear': game.revealed > ni }]"
            >
              {{ game.revealed > ni ? num : '' }}
            </div>
          </div>
        </div>
      </transition-group>

      <!-- 빈 상태 -->
      <div v-if="games.length === 0" class="empty-state">
        <div class="empty-icon">🎯</div>
        <p class="empty-text">번호 생성을 눌러보세요</p>
      </div>
    </main>

    <!-- 기록 섹션 -->
    <section v-if="history.length > 0" class="history-section">
      <div class="history-header">
        <h2 class="title-4">생성 기록</h2>
        <button class="btn-text" @click="history = []">전체 삭제</button>
      </div>
      <div class="history-list">
        <div
          v-for="(entry, ei) in [...history].reverse()"
          :key="ei"
          class="info-row-card"
        >
          <span class="info-row-label">{{ history.length - ei }}회</span>
          <div class="ball-mini-row">
            <span
              v-for="(n, ni) in entry"
              :key="ni"
              :class="['ball-mini', ballColor(n)]"
            >{{ n }}</span>
          </div>
          <span class="info-row-value">{{ sum(entry) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Game {
  id: number
  numbers: number[]
  revealed: number
}

const gameCount = ref(1)
const games = ref<Game[]>([])
const history = ref<number[][]>([])
const isAnimating = ref(false)
let idCounter = 0

function pickNumbers(): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 6).sort((a, b) => a - b)
}

function ballColor(n: number): string {
  if (n <= 10) return 'yellow'
  if (n <= 20) return 'blue'
  if (n <= 30) return 'red'
  if (n <= 40) return 'gray'
  return 'green'
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

async function generate() {
  if (isAnimating.value) return
  isAnimating.value = true

  const newGames: Game[] = Array.from({ length: gameCount.value }, () => ({
    id: ++idCounter,
    numbers: pickNumbers(),
    revealed: 0,
  }))

  games.value = newGames

  for (let reveal = 1; reveal <= 6; reveal++) {
    await delay(180)
    games.value = games.value.map(g => ({ ...g, revealed: reveal }))
  }

  newGames.forEach(g => history.value.push(g.numbers))
  isAnimating.value = false
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}
</script>

<style scoped>
/* ── CSS Variables ── */
.app {
  --primary:       #5F46FF;
  --primary-dark:  #4A35E0;
  --primary-light: #EEEAFF;
  --primary-200:   #F2F0FF;
  --card-bg:       #FFFFFF;
  --muted-bg:      #F5F5F8;
  --border:        #E5E7EB;
  --text-1:        #111827;
  --text-2:        #6B7280;
  --text-3:        #9CA3AF;
  --success:       #10B981;
  --error:         #EF4444;

  max-width: 480px;
  margin: 0 auto;
  padding: 32px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Typography ── */
.display {
  font-size: 36px; font-weight: 700;
  letter-spacing: -0.5px; color: var(--text-1);
}
.title-4 {
  font-size: 16px; font-weight: 700;
  letter-spacing: -0.3px; color: var(--text-1);
}
.body-2 {
  font-size: 14px; font-weight: 400;
  color: var(--text-2);
}
.caption-1 {
  font-size: 13px; font-weight: 400;
  letter-spacing: -0.2px; color: var(--text-2);
}

/* ── Header ── */
.header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

/* ── Card ── */
.card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  margin: 0;
}

/* ── Chip ── */
.chip-row {
  display: flex;
  gap: 8px;
}

.chip {
  border: 1.5px solid var(--border);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  border-radius: 9999px;
  padding: 6px 20px;
  background: transparent;
  cursor: pointer;
  transition: none;
}

.chip.active {
  border-color: var(--primary);
  background: var(--primary);
  color: #FFFFFF;
}

.chip:active:not(.active) {
  background: var(--muted-bg);
}

/* ── Button ── */
.btn-primary {
  width: 100%;
  height: 56px;
  background: var(--primary);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  font-family: inherit;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}

.btn-primary:active:not(:disabled) {
  background: var(--primary-dark);
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-text {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  padding: 0 4px;
}

/* ── Results ── */
.results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ── Badge ── */
.badge-primary {
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 6px;
}

/* ── Balls ── */
.balls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ball {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  opacity: 0;
  transform: scale(0.5);
  transition: transform 0.2s cubic-bezier(.34, 1.56, .64, 1), opacity 0.18s ease;
}

.ball.ball-appear {
  opacity: 1;
  transform: scale(1);
}

.ball.yellow { background: #F7C948; }
.ball.blue   { background: #4A90D9; }
.ball.red    { background: #E8464B; }
.ball.gray   { background: #888888; }
.ball.green  { background: #4CAF50; }

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 10px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.35;
}

.empty-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-2);
}

/* ── History ── */
.history-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.info-row-label {
  font-size: 13px;
  color: var(--text-2);
  min-width: 28px;
}

.info-row-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  min-width: 36px;
  text-align: right;
}

.ball-mini-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.ball-mini {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}

.ball-mini.yellow { background: #F7C948; }
.ball-mini.blue   { background: #4A90D9; }
.ball-mini.red    { background: #E8464B; }
.ball-mini.gray   { background: #888888; }
.ball-mini.green  { background: #4CAF50; }

/* ── Animation ── */
.slide-up-enter-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
