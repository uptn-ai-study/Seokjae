<script setup lang="ts">
defineProps<{
  value: number
  selected?: boolean
  shaking?: boolean
  correct?: boolean
}>()

defineEmits<{ click: [] }>()

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
</script>

<template>
  <div
    class="die"
    :class="{ selected, shaking, correct }"
    @click="$emit('click')"
  >
    <div class="pip-grid">
      <span v-for="i in 9" :key="i" class="pip-slot">
        <span v-if="PIP_POSITIONS[value]?.includes(i - 1)" class="pip" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.die {
  /* 그리드 셀 내에서: 너비는 셀 전체, 높이는 aspect-ratio로 결정
     max-height: 100%로 셀 높이를 초과하지 않음 (행이 좁을 때 대응) */
  width: 100%;
  aspect-ratio: 1;
  max-height: 100%;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 0 2px transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
}

.die:active:not(.selected):not(.correct) {
  transform: scale(0.93);
}

.die.selected {
  background: var(--primary-light);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 2.5px var(--primary);
  transform: scale(1.06);
}

.die.correct {
  background: #D1FAE5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 2.5px var(--success);
  transform: scale(1.06);
}

.die.shaking {
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0) scale(1); }
  15%       { transform: translateX(-7px) scale(1); }
  30%       { transform: translateX(7px) scale(1); }
  45%       { transform: translateX(-5px) scale(1); }
  60%       { transform: translateX(5px) scale(1); }
  75%       { transform: translateX(-3px) scale(1); }
  90%       { transform: translateX(3px) scale(1); }
}

.pip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 62%;
  height: 62%;
  gap: 3px;
}

.pip-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pip {
  width: 64%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--text-1);
  transition: background 0.12s ease;
}

.die.selected .pip { background: var(--primary); }
.die.correct .pip  { background: var(--success); }
</style>
