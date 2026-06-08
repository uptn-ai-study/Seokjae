<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Difficulty } from '../composables/useGame'
import { useScores } from '../composables/useScores'

const props = defineProps<{
  score: number
  difficulty: Difficulty
}>()

defineEmits<{ restart: []; home: [] }>()

const { addScore, getScores } = useScores()

const isNewRecord = ref(false)
const currentRank = ref(0)
const topScores = ref<number[]>([])

onMounted(() => {
  const result = addScore(props.score, props.difficulty)
  isNewRecord.value = result.isNewRecord
  currentRank.value = result.rank
  topScores.value = getScores(props.difficulty)
})

const rank = computed(() => {
  if (props.score >= 200) return { emoji: '🏆', text: '전설급이에요!', color: '#F59E0B' }
  if (props.score >= 150) return { emoji: '🔥', text: '대단한데요!', color: '#EF4444' }
  if (props.score >= 100) return { emoji: '⭐', text: '훌륭해요!', color: '#5F46FF' }
  if (props.score >= 50)  return { emoji: '👍', text: '잘하고 있어요!', color: '#10B981' }
  return { emoji: '🌱', text: '좋은 시작이에요!', color: '#6B7280' }
})

const diffLabel = computed(() =>
  props.difficulty === 'beginner' ? '초보자' : '숙련자'
)

const medals = ['🥇', '🥈', '🥉']

/** 빈 슬롯 수 (TOP 5 채우기용) */
const emptySlots = computed(() => Math.max(0, 5 - topScores.value.length))
</script>

<template>
  <div class="result">

    <!-- 랭크 + 신기록 배지 -->
    <div class="rank-area">
      <div class="rank-emoji">{{ rank.emoji }}</div>
      <p class="rank-text" :style="{ color: rank.color }">{{ rank.text }}</p>
      <Transition name="pop">
        <span v-if="isNewRecord" class="new-record">🎉 신기록!</span>
      </Transition>
    </div>

    <!-- 점수 + High Score 카드 -->
    <div class="score-card">
      <!-- 이번 점수 -->
      <div class="score-info">
        <span class="info-label">이번 점수</span>
        <div class="info-score-row">
          <span class="info-score">{{ score }}<span class="unit">pt</span></span>
          <span v-if="currentRank > 0" class="rank-badge">
            {{ currentRank }}위
          </span>
        </div>
      </div>

      <div class="divider" />

      <!-- 개인 기록 TOP 5 -->
      <div class="hiscore-section">
        <p class="hiscore-title">
          <span>개인 기록</span>
          <span class="diff-tag" :class="difficulty">{{ diffLabel }}</span>
        </p>
        <div class="hiscore-list">
          <div
            v-for="(s, i) in topScores"
            :key="i"
            class="hiscore-row"
            :class="{ current: i === currentRank - 1 }"
          >
            <span class="row-medal">{{ medals[i] ?? '' }}</span>
            <span class="row-num">{{ i + 1 }}</span>
            <span class="row-score">{{ s }}<span class="row-unit"> pt</span></span>
            <span v-if="i === currentRank - 1" class="now-chip">NOW</span>
          </div>
          <!-- 빈 슬롯 -->
          <div
            v-for="i in emptySlots"
            :key="`empty-${i}`"
            class="hiscore-row empty"
          >
            <span class="row-medal" />
            <span class="row-num">{{ topScores.length + i }}</span>
            <span class="row-score">—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 버튼 -->
    <div class="actions">
      <button class="btn-primary" @click="$emit('restart')">
        다시 도전하기
      </button>
      <button class="btn-gray" @click="$emit('home')">
        난이도 변경
      </button>
    </div>

  </div>
</template>

<style scoped>
.result {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 20px 28px;
  gap: 20px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
}

/* 랭크 영역 */
.rank-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.rank-emoji {
  font-size: 64px;
  line-height: 1;
  animation: bounceIn 0.5s cubic-bezier(.36,.07,.19,.97);
}

@keyframes bounceIn {
  0%   { transform: scale(0.3); opacity: 0; }
  60%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}

.rank-text {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.new-record {
  display: inline-block;
  background: #FEF3C7;
  color: #D97706;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 14px;
  border-radius: 9999px;
  letter-spacing: -0.2px;
}

.pop-enter-active { animation: popIn 0.35s cubic-bezier(.36,.07,.19,.97); }
@keyframes popIn {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}

/* 점수 카드 */
.score-card {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.score-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 400;
  letter-spacing: -0.2px;
}

.info-score-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.info-score {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -1px;
  line-height: 1;
}

.unit {
  font-size: 20px;
  font-weight: 500;
  color: var(--text-3);
  margin-left: 2px;
}

.rank-badge {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-light);
  padding: 3px 10px;
  border-radius: 9999px;
}

.divider {
  height: 1px;
  background: var(--border);
}

/* High Score 섹션 */
.hiscore-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hiscore-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  letter-spacing: -0.2px;
}

.diff-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 9999px;
}
.diff-tag.beginner { background: var(--muted-bg); color: var(--text-2); }
.diff-tag.expert   { background: var(--primary-light); color: var(--primary); }

.hiscore-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hiscore-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  transition: background 0.15s ease;
}

.hiscore-row.current {
  background: var(--primary-200);
  box-shadow: inset 0 0 0 1.5px var(--primary-light);
}

.hiscore-row.empty {
  opacity: 0.35;
}

.row-medal {
  width: 18px;
  font-size: 15px;
  text-align: center;
  flex-shrink: 0;
}

.row-num {
  width: 16px;
  font-size: 13px;
  color: var(--text-3);
  font-weight: 500;
  text-align: right;
  flex-shrink: 0;
}

.row-score {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.3px;
}

.row-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.now-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-light);
  padding: 2px 8px;
  border-radius: 9999px;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

/* 버튼 */
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.btn-primary {
  width: 100%;
  height: 56px;
  background: var(--primary);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.btn-primary:active { background: var(--primary-dark); transform: scale(0.98); }

.btn-gray {
  width: 100%;
  height: 48px;
  background: var(--muted-bg);
  color: var(--text-2);
  border: 1px solid var(--border);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.btn-gray:active { transform: scale(0.98); }
</style>
