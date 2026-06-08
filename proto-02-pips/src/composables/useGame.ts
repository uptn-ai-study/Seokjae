import { ref, computed } from 'vue'

export type Difficulty = 'beginner' | 'expert'

export function useGame(difficulty: Difficulty) {
  const DICE_COUNT = difficulty === 'beginner' ? 6 : 9
  const TIME_LIMIT = difficulty === 'beginner' ? 90 : 60

  // dice       : 게임 로직의 실제 값 (checkAnswer 등에서 사용)
  // displayDice: 화면에 렌더링되는 값 (셔플 중엔 랜덤 순환값)
  const dice        = ref<number[]>([])
  const displayDice = ref<number[]>([])
  const isShuffling         = ref(false)
  const shufflingIndices    = ref<Set<number>>(new Set())

  const selected  = ref<Set<number>>(new Set())
  const target    = ref(0)
  const score     = ref(0)
  const combo     = ref(0)
  const timeLeft  = ref(TIME_LIMIT)
  const isShaking = ref(false)
  const isCorrect = ref(false)
  const isGameOver = ref(false)
  let timerId: ReturnType<typeof setInterval> | null = null

  const isAnimating = computed(
    () => isShaking.value || isCorrect.value || isShuffling.value
  )

  const selectedSum = computed(() =>
    [...selected.value].reduce((sum, i) => sum + (dice.value[i] ?? 0), 0)
  )

  function randomDie(): number {
    return Math.floor(Math.random() * 6) + 1
  }

  function generateTarget() {
    const count   = Math.floor(Math.random() * 2) + 2
    const shuffled = [...Array(dice.value.length).keys()]
      .sort(() => Math.random() - 0.5)
    const picked    = shuffled.slice(0, count)
    const newTarget = picked.reduce((sum, i) => sum + dice.value[i], 0)

    if (newTarget === target.value && dice.value.length >= 3) {
      generateTarget()
      return
    }
    target.value = newTarget
  }

  function init() {
    dice.value        = Array.from({ length: DICE_COUNT }, randomDie)
    displayDice.value = [...dice.value]    // 초기엔 실제값과 동일
    selected.value    = new Set()
    score.value       = 0
    combo.value       = 0
    timeLeft.value    = TIME_LIMIT
    isShaking.value   = false
    isCorrect.value   = false
    isShuffling.value = false
    shufflingIndices.value = new Set()
    isGameOver.value  = false
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
    if (sum === target.value) handleCorrect([...next])
    else if (sum > target.value) handleWrong()
  }

  function handleCorrect(indices: number[]) {
    combo.value++
    const mult = difficulty === 'expert' ? Math.min(combo.value, 5) : 1
    score.value += 10 * mult
    isCorrect.value = true

    // 최종값 미리 결정 (셔플이 끝난 뒤 이 값으로 확정)
    const finalDice = [...dice.value]
    indices.forEach(i => { finalDice[i] = randomDie() })

    // ─ Phase 1 (0~180ms): 정답 초록 글로우 유지 ─
    setTimeout(() => {
      selected.value  = new Set()
      isCorrect.value = false
      isShuffling.value      = true
      shufflingIndices.value = new Set(indices)

      // ─ Phase 2 (180~620ms): 교체 주사위 슬롯머신 순환 ─
      // 55ms 간격 × 8회 = 440ms
      const INTERVAL = 55
      const CYCLES   = 8
      let count = 0

      const shuffleId = setInterval(() => {
        count++
        // 교체 대상만 랜덤값으로 순환, 나머지는 finalDice 그대로
        const temp = [...finalDice]
        indices.forEach(i => { temp[i] = randomDie() })
        displayDice.value = temp

        if (count >= CYCLES) {
          clearInterval(shuffleId)

          // ─ Phase 3: 최종값 확정, 상태 리셋 ─
          dice.value        = finalDice
          displayDice.value = [...finalDice]
          isShuffling.value      = false
          shufflingIndices.value = new Set()
          generateTarget()
        }
      }, INTERVAL)
    }, 180)
  }

  function handleWrong() {
    combo.value = 0
    isShaking.value = true
    setTimeout(() => {
      selected.value  = new Set()
      isShaking.value = false
    }, 500)
  }

  function destroy() { stopTimer() }

  return {
    dice, displayDice, isShuffling, shufflingIndices,
    selected, target, score, combo, timeLeft,
    isShaking, isCorrect, isGameOver, isAnimating, selectedSum,
    DICE_COUNT, TIME_LIMIT, init, toggleDie, destroy,
  }
}
