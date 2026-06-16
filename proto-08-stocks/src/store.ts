// 모의투자 포트폴리오 상태.
// 세션(시드머니 10억)은 localStorage에 저장되어 새로고침해도 유지된다.
import { reactive, computed } from 'vue'
import type { Quote } from './api'

export const SEED = 1_000_000_000 // 시드머니 10억 원
const STORAGE_KEY = 'proto08-mock-invest-v1'

export interface Holding {
  qty: number       // 보유 수량
  avgPrice: number  // 평균 매입 단가
}

export interface TxLog {
  id: number
  type: 'BUY' | 'SELL'
  code: string
  name: string
  qty: number
  price: number
  at: number // timestamp
}

interface SessionState {
  startedAt: number
  cash: number
  holdings: Record<string, Holding>
  realizedPL: number   // 매도로 확정된 실현 손익 누계
  txs: TxLog[]
  txSeq: number
}

function freshSession(): SessionState {
  return {
    startedAt: Date.now(),
    cash: SEED,
    holdings: {},
    realizedPL: 0,
    txs: [],
    txSeq: 0,
  }
}

function load(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState
      if (typeof parsed.cash === 'number' && parsed.holdings) return parsed
    }
  } catch {
    /* ignore */
  }
  return freshSession()
}

const state = reactive<SessionState>(load())

// 실시간 시세 캐시 (code → Quote). 폴링으로 갱신.
export const prices = reactive<Record<string, Quote>>({})

export const meta = reactive({ lastFetchedAt: '' })

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function updatePrices(quotes: Quote[]) {
  for (const q of quotes) {
    if (q.price > 0) prices[q.code] = q
  }
  meta.lastFetchedAt = new Date().toISOString()
}

// 특정 종목 현재가 (시세 없으면 평균단가로 폴백)
export function priceOf(code: string): number {
  const q = prices[code]
  if (q && q.price > 0) return q.price
  const h = state.holdings[code]
  return h ? h.avgPrice : 0
}

export interface TradeResult {
  ok: boolean
  message: string
}

export function buy(code: string, name: string, qty: number, price: number): TradeResult {
  if (qty <= 0) return { ok: false, message: '수량을 입력해주세요.' }
  if (price <= 0) return { ok: false, message: '현재가를 불러오지 못했어요.' }
  const cost = qty * price
  if (cost > state.cash) return { ok: false, message: '보유 현금이 부족합니다.' }

  const h = state.holdings[code] ?? { qty: 0, avgPrice: 0 }
  const newQty = h.qty + qty
  // 평균 매입 단가 갱신
  h.avgPrice = (h.qty * h.avgPrice + cost) / newQty
  h.qty = newQty
  state.holdings[code] = h
  state.cash -= cost

  state.txs.unshift({ id: ++state.txSeq, type: 'BUY', code, name, qty, price, at: Date.now() })
  persist()
  return { ok: true, message: `${name} ${qty.toLocaleString('ko-KR')}주 매수 완료` }
}

export function sell(code: string, name: string, qty: number, price: number): TradeResult {
  if (qty <= 0) return { ok: false, message: '수량을 입력해주세요.' }
  const h = state.holdings[code]
  if (!h || h.qty < qty) return { ok: false, message: '보유 수량이 부족합니다.' }
  if (price <= 0) return { ok: false, message: '현재가를 불러오지 못했어요.' }

  const proceeds = qty * price
  state.realizedPL += (price - h.avgPrice) * qty
  h.qty -= qty
  if (h.qty === 0) delete state.holdings[code]
  else state.holdings[code] = h
  state.cash += proceeds

  state.txs.unshift({ id: ++state.txSeq, type: 'SELL', code, name, qty, price, at: Date.now() })
  persist()
  return { ok: true, message: `${name} ${qty.toLocaleString('ko-KR')}주 매도 완료` }
}

export function resetSession() {
  const fresh = freshSession()
  Object.assign(state, fresh)
  // holdings/txs는 새 객체로 교체
  state.holdings = {}
  state.txs = []
  persist()
}

// ── 파생 값 ───────────────────────────────────────────────
export const holdingCodes = computed(() => Object.keys(state.holdings))

// 주식 평가액(현재가 기준)
export const stockValue = computed(() =>
  holdingCodes.value.reduce((sum, code) => sum + state.holdings[code].qty * priceOf(code), 0),
)

// 총 자산 = 현금 + 주식 평가액
export const totalAsset = computed(() => state.cash + stockValue.value)

// 총 매입 원가(보유 중인 종목)
export const totalCost = computed(() =>
  holdingCodes.value.reduce(
    (sum, code) => sum + state.holdings[code].qty * state.holdings[code].avgPrice,
    0,
  ),
)

// 평가 손익(보유 주식의 미실현 손익)
export const evalPL = computed(() => stockValue.value - totalCost.value)

// 총 수익률 = (총자산 - 시드) / 시드
export const totalReturnRate = computed(() => ((totalAsset.value - SEED) / SEED) * 100)

// 총 손익액 = 총자산 - 시드
export const totalPL = computed(() => totalAsset.value - SEED)

export function holdingOf(code: string): Holding | undefined {
  return state.holdings[code]
}

export { state }
