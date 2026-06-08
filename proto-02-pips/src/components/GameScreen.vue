<script setup lang="ts">
import { onMounted, onUnmounted, watch, computed, ref, nextTick } from 'vue'
import DiceFace from './DiceFace.vue'
import { useGame, type Difficulty } from '../composables/useGame'

const props = defineProps<{ difficulty: Difficulty }>()
const emit = defineEmits<{ gameOver: [score: number] }>()

const {
  displayDice, isShuffling, shufflingIndices,
  selected, target, score, combo, timeLeft,
  isShaking, isCorrect, isGameOver, selectedSum,
  TIME_LIMIT, init, toggleDie, destroy,
} = useGame(props.difficulty)

// ── 주사위 크기 계산 (ResizeObserver 기반) ──────────────────────
// CSS의 grid-auto-rows:1fr 이 Safari/iOS flex 컨테이너에서 불안정하므로
// 실제 DOM 크기를 측정해 주사위 한 변 px을 직접 계산한다.
const COLS = 3
const GAP  = 10   // px, grid gap 고정값

const rows       = computed(() => props.difficulty === 'beginner' ? 2 : 3)
const diceAreaRef = ref<HTMLElement | null>(null)
const dieSize     = ref(80)   // 초기값(렌더 전 폴백)
let ro: ResizeObserver | null = null

function computeDieSize() {
  const el = diceAreaRef.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  const byWidth  = Math.floor((w - (COLS - 1) * GAP) / COLS)
  const byHeight = Math.floor((h - (rows.value - 1) * GAP) / rows.value)
  dieSize.value = Math.max(36, Math.min(byWidth, byHeight))
}

// 주사위 그리드에 적용할 인라인 스타일
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${COLS}, ${dieSize.value}px)`,
  gridTemplateRows:    `repeat(${rows.value}, ${dieSize.value}px)`,
  gap:                 `${GAP}px`,
}))

// ── 게임 로직 ────────────────────────────────────────────────────
onMounted(() => {
  init()
  nextTick(() => {
    computeDieSize()
    ro = new ResizeObserver(computeDieSize)
    if (diceAreaRef.value) ro.observe(diceAreaRef.value)
  })
})

onUnmounted(() => {
  destroy()
  ro?.disconnect()
})

watch(isGameOver, (over) => {
  if (over) setTimeout(() => emit('gameOver', score.value), 900)
})

const timerPct    = computed(() => (timeLeft.value / TIME_LIMIT) * 100)
const timerDanger = computed(() => timeLeft.value <= 15)
</script>

<template>
  <div class="game">

    <!-- ① 헤더 -->
    <div class="header">
      <div class="score-block">
        <span class="label">점수</span>
        <span class="score-val">{{ score }}</span>
      </div>

      <div class="timer-block">
        <svg class="timer-ring" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="#E5E7EB" stroke-width="3" />
          <circle
            cx="20" cy="20" r="16" fill="none"
            :stroke="timerDanger ? '#EF4444' : '#5F46FF'"
            stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="`${timerPct * 1.005} 100.5`"
            transform="rotate(-90 20 20)"
            style="transition: stroke-dasharray 0.9s linear, stroke 0.3s ease;"
          />
        </svg>
        <span class="timer-num" :class="{ danger: timerDanger }">{{ timeLeft }}</span>
      </div>
    </div>

    <!-- ② 목표 숫자 -->
    <div class="target-area">
      <p class="target-label">목표</p>
      <div class="target-num">{{ target }}</div>
      <div class="sum-row">
        <span class="sum-label">선택 합계</span>
        <span
          class="sum-val"
          :class="{
            'sum-match': selectedSum === target && selectedSum > 0,
            'sum-over':  selectedSum > target,
          }"
        >{{ selectedSum }}</span>
      </div>
    </div>

    <!-- ③ 콤보 (숙련자만) -->
    <div v-if="difficulty === 'expert'" class="combo-row">
      <Transition name="chip">
        <span v-if="combo >= 2" class="combo-chip" :key="combo">
          🔥 {{ combo }}연속 &nbsp;×{{ Math.min(combo, 5) }}
        </span>
      </Transition>
      <span v-if="combo < 2" class="combo-empty">연속 성공으로 배율 상승!</span>
    </div>

    <!-- ④ 주사위 영역 : ResizeObserver 측정 대상 -->
    <div class="dice-area" ref="diceAreaRef">
      <div class="dice-grid" :style="gridStyle">
        <DiceFace
          v-for="(val, i) in displayDice"
          :key="i"
          :value="val"
          :selected="selected.has(i)"
          :shaking="isShaking && selected.has(i)"
          :correct="isCorrect && selected.has(i)"
          :shuffling="isShuffling && shufflingIndices.has(i)"
          :style="{ '--enter-delay': `${i * 35}ms` }"
          @click="toggleDie(i)"
        />
      </div>
    </div>

    <!-- ⑤ 게임 오버 오버레이 -->
    <Transition name="fade">
      <div v-if="isGameOver" class="gameover-overlay">
        <div class="gameover-box">
          <p class="gameover-emoji">⏰</p>
          <p class="gameover-text">시간 종료!</p>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* ────────────────────────────────────────────────────────────
   게임 컨테이너
   - flex: 1 + min-height: 0 → 부모 높이 초과 금지
────────────────────────────────────────────────────────────── */
.game {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 20px 16px;
  gap: 12px;
  position: relative;
  overflow: hidden;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

/* ① 헤더 */
.header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
}

.score-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label {
  font-size: 12px;
  color: var(--text-3);
  letter-spacing: -0.2px;
}

.score-val {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.5px;
  line-height: 1;
}

.timer-block {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timer-ring {
  position: absolute;
  inset: 0;
}

.timer-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  z-index: 1;
}
.timer-num.danger { color: var(--error); }

/* ② 목표 숫자 카드 */
.target-area {
  flex-shrink: 0;
  background: var(--card-bg);
  border-radius: 18px;
  padding: 12px 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.target-label {
  font-size: 12px;
  color: var(--text-3);
  letter-spacing: -0.2px;
}

.target-num {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--text-1);
  line-height: 1.05;
}

.sum-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sum-label {
  font-size: 13px;
  color: var(--text-3);
}

.sum-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-2);
  letter-spacing: -0.3px;
  transition: color 0.15s ease;
  min-width: 24px;
  text-align: center;
}
.sum-val.sum-match { color: var(--success); }
.sum-val.sum-over  { color: var(--error); }

/* ③ 콤보 */
.combo-row {
  flex-shrink: 0;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.combo-chip {
  position: absolute;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 3px 14px;
  border-radius: 9999px;
  letter-spacing: -0.2px;
}

.combo-empty {
  font-size: 12px;
  color: var(--text-3);
}

.chip-enter-active { animation: popIn .25s ease; }
.chip-leave-active { animation: popIn .15s ease reverse; }

@keyframes popIn {
  from { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.1); }
  to   { transform: scale(1);   opacity: 1; }
}

/* ────────────────────────────────────────────────────────────
   ④ 주사위 영역
   dice-area  : flex: 1 → 남은 공간 전부 차지, 측정 대상
   dice-grid  : JS로 px 단위 명시 → Safari 포함 모든 브라우저에서 안정
────────────────────────────────────────────────────────────── */
.dice-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dice-grid {
  display: grid;
  /* gridTemplateColumns / gridTemplateRows / gap 은 :style 로 주입 */
}

/* ⑤ 게임 오버 */
.gameover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.gameover-box {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 28px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.gameover-emoji { font-size: 44px; }
.gameover-text  {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.3px;
}

.fade-enter-active,
.fade-leave-active { transition: opacity .3s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
