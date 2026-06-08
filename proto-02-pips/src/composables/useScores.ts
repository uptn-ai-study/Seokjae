import { ref } from 'vue'
import type { Difficulty } from './useGame'

const STORAGE_KEY = 'pips_hiscores'
const MAX_ENTRIES = 5

interface ScoreStore {
  beginner: number[]
  expert: number[]
}

function load(): ScoreStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { beginner: [], expert: [] }
  } catch {
    return { beginner: [], expert: [] }
  }
}

function persist(store: ScoreStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function useScores() {
  const store = ref<ScoreStore>(load())

  /** 점수를 추가하고 신기록 여부와 순위(1-indexed)를 반환 */
  function addScore(score: number, difficulty: Difficulty): { isNewRecord: boolean; rank: number } {
    const prev = store.value[difficulty]
    const prevBest = prev[0] ?? -1
    const isNewRecord = score > prevBest

    const list = [...prev, score]
      .sort((a, b) => b - a)
      .slice(0, MAX_ENTRIES)

    const rank = list.findIndex(s => s === score) + 1

    store.value = { ...store.value, [difficulty]: list }
    persist(store.value)

    return { isNewRecord, rank }
  }

  function getScores(difficulty: Difficulty): number[] {
    return store.value[difficulty]
  }

  return { addScore, getScores }
}
