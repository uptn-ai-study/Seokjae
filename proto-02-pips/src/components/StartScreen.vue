<script setup lang="ts">
import type { Difficulty } from '../composables/useGame'

defineEmits<{ start: [difficulty: Difficulty] }>()
</script>

<template>
  <div class="start">
    <div class="hero">
      <div class="logo">⚄</div>
      <h1 class="title">PIPS</h1>
      <p class="tagline">주사위를 탭해서 합계를 맞춰라</p>
    </div>

    <div class="rules-card">
      <div class="rule">
        <span class="rule-icon">👆</span>
        <span class="rule-text">주사위를 탭해 선택</span>
      </div>
      <div class="rule">
        <span class="rule-icon">🎯</span>
        <span class="rule-text">선택 합계 = 목표 숫자면 성공</span>
      </div>
      <div class="rule">
        <span class="rule-icon">⏱</span>
        <span class="rule-text">시간 안에 최대한 많이!</span>
      </div>
    </div>

    <div class="difficulty-section">
      <p class="difficulty-label">난이도 선택</p>
      <div class="btn-row">
        <button class="btn-mode btn-beginner" @click="$emit('start', 'beginner')">
          <span class="mode-emoji">😊</span>
          <span class="mode-name">초보자</span>
          <span class="mode-desc">주사위 6개 · 90초</span>
        </button>
        <button class="btn-mode btn-expert" @click="$emit('start', 'expert')">
          <span class="mode-emoji">🔥</span>
          <span class="mode-name">숙련자</span>
          <span class="mode-desc">주사위 9개 · 60초 · 콤보</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.start {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 28px;
}

.hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo {
  font-size: 72px;
  line-height: 1;
  filter: drop-shadow(0 4px 12px rgba(95,70,255,0.25));
}

.title {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--text-1);
  line-height: 1;
}

.tagline {
  font-size: 15px;
  color: var(--text-2);
  font-weight: 400;
  letter-spacing: -0.2px;
}

.rules-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rule-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}

.rule-text {
  font-size: 14px;
  color: var(--text-1);
  font-weight: 400;
  letter-spacing: -0.2px;
}

.difficulty-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.difficulty-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: -0.2px;
  text-align: center;
}

.btn-row {
  display: flex;
  gap: 10px;
}

.btn-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 18px 12px;
  border-radius: 16px;
  border: 2.5px solid transparent;
  background: var(--card-bg);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.btn-mode:active {
  transform: scale(0.96);
}

.btn-beginner {
  border-color: var(--border);
}

.btn-expert {
  border-color: var(--primary);
  background: var(--primary-200);
}

.mode-emoji {
  font-size: 28px;
  line-height: 1;
}

.mode-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.3px;
}

.mode-desc {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 400;
  letter-spacing: -0.2px;
}
</style>
