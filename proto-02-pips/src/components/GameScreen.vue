<script setup lang="ts">
import { onMounted, onUnmounted, watch, computed } from 'vue'
import DiceFace from './DiceFace.vue'
import { useGame, type Difficulty } from '../composables/useGame'

const props = defineProps<{ difficulty: Difficulty }>()
const emit = defineEmits<{ gameOver: [score: number] }>()

const {
  dice, selected, target, score, combo, timeLeft,
  isShaking, isCorrect, isGameOver, selectedSum,
  TIME_LIMIT, init, toggleDie, destroy,
} = useGame(props.difficulty)

onMounted(init)
onUnmounted(destroy)

watch(isGameOver, (over) => {
  if (over) setTimeout(() => emit('gameOver', score.value), 900)
})

const timerPct = computed(() => (timeLeft.value / TIME_LIMIT) * 100)
const timerDanger = computed(() => timeLeft.value <= 15)

// 열/행 수는 CSS grid-auto-rows: 1fr 로 자동 처리
</script>

<template>
  <div class="game">
    <!-- 헤더 -->
    <div class="header">
      <div class="score-block">
        <span class="label">점수</span>
        <span class="score-val">{{ score }}</span>
      </div>

      <div class="timer-block" :class="{ danger: timerDanger }">
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

    <!-- 목표 영역 -->
    <div class="target-area">
      <p class="target-label">목표</p>
      <div class="target-num">{{ target }}</div>
      <div class="sum-row">
        <span class="sum-label">선택 합계</span>
        <span
          class="sum-val"
          :class="{
            'sum-match': selectedSum === target && selectedSum > 0,
            'sum-over': selectedSum > target,
          }"
        >{{ selectedSum }}</span>
      </div>
    </div>

    <!-- 콤보 (숙련자) -->
    <div v-if="difficulty === 'expert'" class="combo-row">
      <span v-if="combo >= 2" class="combo-chip">
        🔥 {{ combo }}연속  ×{{ Math.min(combo, 5) }}
      </span>
      <span v-else class="combo-empty">연속 성공으로 배율 상승!</span>
    </div>

    <!-- 주사위 그리드 -->
    <div class="dice-grid">
      <DiceFace
        v-for="(val, i) in dice"
        :key="i"
        :value="val"
        :selected="selected.has(i)"
        :shaking="isShaking && selected.has(i)"
        :correct="isCorrect && selected.has(i)"
        @click="toggleDie(i)"
      />
    </div>

    <!-- 게임 오버 오버레이 -->
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
/* ─────────────────────────────────────────
   게임 전체 컨테이너
   flex: 1 + min-height: 0 → 부모 높이를 초과하지 않음
   dvh: 모바일 브라우저 주소창 높이 변동 대응
───────────────────────────────────────── */
.game {
  flex: 1;
  min-height: 0;               /* flex 자식이 줄어들 수 있게 필수 */
  display: flex;
  flex-direction: column;
  padding: clamp(10px, 2dvh, 16px) 20px clamp(12px, 3dvh, 24px);
  gap: clamp(8px, 2dvh, 16px);
  position: relative;
  overflow: hidden;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

/* 헤더 — flex-shrink: 0 으로 고정 */
.header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 400;
  letter-spacing: -0.2px;
}

.score-val {
  font-size: clamp(22px, 5dvh, 28px);
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.5px;
  line-height: 1;
}

.timer-block {
  flex-shrink: 0;
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.timer-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.3px;
  z-index: 1;
}
.timer-num.danger { color: var(--error); }

/* 목표 영역 — 화면이 작을 때 padding과 폰트 축소 */
.target-area {
  flex-shrink: 1;              /* 공간 부족 시 먼저 줄어듦 */
  background: var(--card-bg);
  border-radius: 20px;
  padding: clamp(10px, 2dvh, 18px) 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.target-label {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 400;
  letter-spacing: -0.2px;
}

.target-num {
  font-size: clamp(36px, 8dvh, 56px);  /* 화면 높이에 따라 유연하게 */
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--text-1);
  line-height: 1;
}

.sum-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sum-label {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 400;
}

.sum-val {
  font-size: clamp(16px, 3.5dvh, 20px);
  font-weight: 700;
  color: var(--text-2);
  letter-spacing: -0.3px;
  transition: color 0.15s ease;
  min-width: 28px;
  text-align: center;
}
.sum-val.sum-match { color: var(--success); }
.sum-val.sum-over  { color: var(--error); }

/* 콤보 — 최소 높이로 고정, 내용만 표시 */
.combo-row {
  flex-shrink: 0;
  height: clamp(22px, 3.5dvh, 28px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.combo-chip {
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 3px 14px;
  border-radius: 9999px;
  letter-spacing: -0.2px;
  animation: pop 0.2s ease;
}

.combo-empty {
  font-size: 12px;
  color: var(--text-3);
  letter-spacing: -0.2px;
}

@keyframes pop {
  0%   { transform: scale(0.8); }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* ─────────────────────────────────────────
   주사위 그리드
   - flex: 1 + min-height: 0 → 남은 공간만 차지 (필수)
   - grid-template-columns: 3열 고정
   - grid-auto-rows: 1fr → 행 높이 균등 자동 분배
     (beginner 6개→2행, expert 9개→3행)
   - justify/align-items: stretch → 셀 전체 채움
     (center로 하면 width:100%와 충돌해 일부 셀이 0높이 버그 발생)
───────────────────────────────────────── */
.dice-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: clamp(8px, 2dvh, 12px);
}

/* 게임 오버 오버레이 */
.gameover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 24px;
}

.gameover-box {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.gameover-emoji { font-size: 48px; }
.gameover-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.3px;
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,
.fade-leave-to   { opacity: 0; }
</style>
