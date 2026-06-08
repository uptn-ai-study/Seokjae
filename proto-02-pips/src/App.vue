<script setup lang="ts">
import { ref } from 'vue'
import StartScreen from './components/StartScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import type { Difficulty } from './composables/useGame'

type Screen = 'start' | 'game' | 'result'

const screen = ref<Screen>('start')
const difficulty = ref<Difficulty>('beginner')
const finalScore = ref(0)
const gameKey = ref(0)   // 재시작마다 증가 → GameScreen 완전 재마운트

function startGame(d: Difficulty) {
  difficulty.value = d
  gameKey.value++
  screen.value = 'game'
}

function onGameOver(score: number) {
  finalScore.value = score
  screen.value = 'result'
}

function restart() {
  gameKey.value++
  screen.value = 'game'
}

function goHome() {
  screen.value = 'start'
}
</script>

<template>
  <div class="app-shell">
    <Transition name="slide" mode="out-in">
      <StartScreen v-if="screen === 'start'" @start="startGame" />
      <GameScreen
        v-else-if="screen === 'game'"
        :key="gameKey"
        :difficulty="difficulty"
        @game-over="onGameOver"
      />
      <ResultScreen
        v-else
        :score="finalScore"
        :difficulty="difficulty"
        @restart="restart"
        @home="goHome"
      />
    </Transition>
  </div>
</template>

<style>
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--muted-bg);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
