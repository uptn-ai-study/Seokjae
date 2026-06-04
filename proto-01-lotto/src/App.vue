<template>
  <div class="app">
    <header class="header">
      <h1 class="title-1">🎱 로또 번호 생성기</h1>
      <p class="sub-1">행운의 번호를 뽑아보세요</p>
    </header>

    <main class="main">
      <div class="controls">
        <div class="round-control">
          <label class="sub-1">생성 게임 수</label>
          <div class="round-buttons">
            <button
              v-for="n in [1, 3, 5]"
              :key="n"
              :class="['round-btn', { active: gameCount === n }]"
              @click="gameCount = n"
            >
              {{ n }}게임
            </button>
          </div>
        </div>
        <button class="generate-btn" @click="generate" :disabled="isAnimating">
          {{ isAnimating ? '추첨 중...' : '번호 생성' }}
        </button>
      </div>

      <transition-group name="slide-up" tag="div" class="results">
        <div v-for="(game, idx) in games" :key="game.id" class="game-card">
          <div class="game-header">
            <span class="game-label sub-1">{{ idx + 1 }}게임</span>
            <span class="game-sum sub-2">합계: {{ sum(game.numbers) }}</span>
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

      <div v-if="games.length === 0" class="empty">
        <p class="sub-1">버튼을 눌러 로또 번호를 생성하세요</p>
      </div>
    </main>

    <section v-if="history.length > 0" class="history-section">
      <div class="history-header">
        <h2 class="title-3">생성 기록</h2>
        <button class="clear-btn sub-2" @click="history = []">전체 삭제</button>
      </div>
      <table class="history-table">
        <thead>
          <tr>
            <th class="sub-1">회차</th>
            <th class="sub-1">번호</th>
            <th class="sub-1">합계</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, ei) in [...history].reverse()" :key="ei">
            <td class="sub-2">{{ history.length - ei }}</td>
            <td>
              <div class="ball-mini-row">
                <span
                  v-for="(n, ni) in entry"
                  :key="ni"
                  :class="['ball-mini', ballColor(n)]"
                >{{ n }}</span>
              </div>
            </td>
            <td class="sub-2">{{ sum(entry) }}</td>
          </tr>
        </tbody>
      </table>
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
.app {
  max-width: 600px;
  margin: 0 auto;
  padding: 32px 20px 60px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.title-1 {
  font-size: 22px;
  font-weight: 700;
  line-height: 32px;
  letter-spacing: 0;
  color: #444444;
  margin-bottom: 6px;
}

.title-3 {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  letter-spacing: -0.3px;
  color: #333333;
}

.sub-1 {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: -0.3px;
  color: #666666;
}

.sub-2 {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  letter-spacing: -0.3px;
  color: #666666;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  background: #fff;
  border: 1px solid #DDDDDD;
  border-radius: 12px;
  padding: 16px 20px;
}

.round-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.round-buttons {
  display: flex;
  gap: 8px;
}

.round-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #DDDDDD;
  background: #F8F8F8;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: #666666;
  cursor: pointer;
  transition: all 0.15s;
}

.round-btn.active {
  background: #5F61FF;
  border-color: #5F61FF;
  color: #fff;
}

.generate-btn {
  padding: 12px 24px;
  background: #5F61FF;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}

.generate-btn:hover:not(:disabled) {
  opacity: 0.88;
  transform: translateY(-1px);
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.game-card {
  background: #fff;
  border: 1px solid #DDDDDD;
  border-radius: 12px;
  padding: 16px 20px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.game-label {
  color: #5F61FF;
  font-weight: 700;
}

.balls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ball {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  transition: transform 0.2s, opacity 0.2s;
  opacity: 0;
  transform: scale(0.6);
}

.ball.ball-appear {
  opacity: 1;
  transform: scale(1);
}

.ball.yellow  { background: #F7C948; }
.ball.blue    { background: #4A90D9; }
.ball.red     { background: #E8464B; }
.ball.gray    { background: #888888; }
.ball.green   { background: #4CAF50; }

.empty {
  text-align: center;
  padding: 48px 0;
  color: #AAAAAA;
}

.history-section {
  background: #fff;
  border: 1px solid #DDDDDD;
  border-radius: 12px;
  padding: 20px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.clear-btn {
  background: none;
  border: 1px solid #DDDDDD;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-family: inherit;
  color: #666666;
  font-size: 12px;
  transition: background 0.15s;
}

.clear-btn:hover {
  background: #F8F8F8;
}

.history-table {
  width: 100%;
  border: 1px solid #DDDDDD;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  border: 1px solid #EBEBEB;
  padding: 8px 12px;
  text-align: left;
}

.history-table th {
  background: #F8F8F8;
  color: #333333;
}

.history-table td {
  color: #666666;
}

.ball-mini-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.ball-mini {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}

.ball-mini.yellow  { background: #F7C948; }
.ball-mini.blue    { background: #4A90D9; }
.ball-mini.red     { background: #E8464B; }
.ball-mini.gray    { background: #888888; }
.ball-mini.green   { background: #4CAF50; }

.slide-up-enter-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
