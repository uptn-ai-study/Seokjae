<script setup lang="ts">
import { computed } from 'vue'
import type { Difficulty } from '../composables/useGame'

const props = defineProps<{
  score: number
  difficulty: Difficulty
}>()

defineEmits<{
  restart: []
  home: []
}>()

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
</script>

<template>
  <div class="result">
    <div class="rank-area">
      <div class="rank-emoji">{{ rank.emoji }}</div>
      <p class="rank-text" :style="{ color: rank.color }">{{ rank.text }}</p>
    </div>

    <div class="score-card">
      <div class="score-info">
        <span class="info-label">최종 점수</span>
        <span class="info-score">{{ score }}<span class="unit">pt</span></span>
      </div>
      <div class="divider" />
      <div class="detail-row">
        <span class="detail-label">난이도</span>
        <span class="badge" :class="difficulty">{{ diffLabel }}</span>
      </div>
    </div>

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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  gap: 28px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.rank-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.rank-emoji {
  font-size: 72px;
  line-height: 1;
  animation: bounceIn 0.5s cubic-bezier(.36, .07, .19, .97);
}

@keyframes bounceIn {
  0%   { transform: scale(0.3); opacity: 0; }
  60%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}

.rank-text {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.score-card {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.info-label {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 400;
  letter-spacing: -0.2px;
}

.info-score {
  font-size: 56px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -1px;
  line-height: 1;
}

.unit {
  font-size: 24px;
  font-weight: 500;
  color: var(--text-3);
  margin-left: 4px;
}

.divider {
  height: 1px;
  background: var(--border);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-label {
  font-size: 14px;
  color: var(--text-2);
}

.badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 9999px;
}

.badge.beginner {
  background: var(--muted-bg);
  color: var(--text-2);
}

.badge.expert {
  background: var(--primary-light);
  color: var(--primary);
}

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
