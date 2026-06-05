import { ref, computed } from 'vue'

export type Difficulty = 'beginner' | 'expert'

export function useGame(difficulty: Difficulty) {
  const DICE_COUNT = difficulty === 'beginner' ? 6 : 9
  const TIME_LIMIT = difficulty === 'beginner' ? 90 : 60

  const dice = ref<number[]>([])
  const selected = ref<Set<number>>(new Set())
  const target = ref(0)
  const score = ref(0)
  const combo = ref(0)
  const timeLeft = ref(TIME_LIMIT)
  const isShaking = ref(false)
  const isCorrect = ref(false)
  const isGameOver = ref(false)
  let timerId: ReturnType<typeof setInterval> | null = null

  const isAnimating = computed(() => isShaking.value || isCorrect.value)

  const selectedSum = computed(() =>
    [...selected.value].reduce((sum, i) => sum + (dice.value[i] ?? 0), 0)
  )

  function randomDie(): number {
    return Math.floor(Math.random() * 6) + 1
  }

  function generateTarget() {
    const count = Math.floor(Math.random() * 2) + 2
    const shuffled = [...Array(dice.value.length).keys()].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, count)
    target.value = picked.reduce((sum, i) => sum + dice.value[i], 0)
  }

  function init() {
    dice.value = Array.from({ length: DICE_COUNT }, randomDie)
    selected.value = new Set()
    score.value = 0
    combo.value = 0
    timeLeft.value = TIME_LIMIT
    isShaking.value = false
    isCorrect.value = false
    isGameOver.value = false
    generateTarget()
    startTimer()
  }

  function startTimer() {
    if (timerId) clearInterval(timerId)
    timerId = setInterval(() => {
      if (timeLeft.value > 0) {
        timeLeft.value--
      } else {
        stopTimer()
        isGameOver.value = true
      }
    }, 1000)
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null }
  }

  function toggleDie(index: number) {
    if (isAnimating.value || isGameOver.value) return

    const next = new Set(selected.value)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    selected.value = next

    const sum = [...next].reduce((s, i) => s + dice.value[i], 0)

    if (sum === target.value) {
      handleCorrect([...next])
    } else if (sum > target.value) {
      handleWrong()
    }
  }

  function handleCorrect(indices: number[]) {
    combo.value++
    const mult = difficulty === 'expert' ? Math.min(combo.value, 5) : 1
    score.value += 10 * mult
    isCorrect.value = true

    setTimeout(() => {
      const newDice = [...dice.value]
      indices.forEach(i => { newDice[i] = randomDie() })
      dice.value = newDice
      selected.value = new Set()
      isCorrect.value = false
      generateTarget()
    }, 700)
  }

  function handleWrong() {
    combo.value = 0
    isShaking.value = true
    setTimeout(() => {
      selected.value = new Set()
      isShaking.value = false
    }, 500)
  }

  function destroy() { stopTimer() }

  return {
    dice, selected, target, score, combo, timeLeft,
    isShaking, isCorrect, isGameOver, isAnimating, selectedSum,
    DICE_COUNT, TIME_LIMIT, init, toggleDie, destroy,
  }
}
