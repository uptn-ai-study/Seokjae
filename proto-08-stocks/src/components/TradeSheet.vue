<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { priceOf, holdingOf, state, buy, sell, prices } from '../store'
import { CODE_TO_META } from '../data/kospi100'
import { won, pct } from '../format'

const props = defineProps<{ code: string; initialMode: 'BUY' | 'SELL' }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'toast', msg: string): void }>()

const meta = computed(() => CODE_TO_META[props.code])
const quote = computed(() => prices[props.code])
const price = computed(() => priceOf(props.code))
const holding = computed(() => holdingOf(props.code))

const mode = ref<'BUY' | 'SELL'>(props.initialMode)
const qty = ref(0)
const shown = ref(false)

// 슬라이드업 트리거
onMounted(() => requestAnimationFrame(() => (shown.value = true)))

// 모드 전환 시 수량 초기화
watch(mode, () => (qty.value = 0))

// 매수 가능 최대 수량 (현금 기준)
const maxBuyQty = computed(() => (price.value > 0 ? Math.floor(state.cash / price.value) : 0))
// 매도 가능 최대 수량 (보유 기준)
const maxSellQty = computed(() => holding.value?.qty ?? 0)
const maxQty = computed(() => (mode.value === 'BUY' ? maxBuyQty.value : maxSellQty.value))

const amount = computed(() => qty.value * price.value)
const cashAfter = computed(() =>
  mode.value === 'BUY' ? state.cash - amount.value : state.cash + amount.value,
)

function setQty(v: number) {
  qty.value = Math.max(0, Math.min(maxQty.value, Math.floor(v)))
}
function bump(delta: number) {
  setQty(qty.value + delta)
}
function setPercent(p: number) {
  setQty(Math.floor((maxQty.value * p) / 100))
}

const changeClass = computed(() => {
  const r = quote.value?.changeRate ?? 0
  return r > 0 ? 'c-up' : r < 0 ? 'c-down' : 'c-flat'
})

const canSubmit = computed(() => qty.value > 0 && price.value > 0 && qty.value <= maxQty.value)

function close() {
  shown.value = false
  setTimeout(() => emit('close'), 280)
}

function submit() {
  if (!canSubmit.value) return
  const m = meta.value
  const res =
    mode.value === 'BUY'
      ? buy(props.code, m.name, qty.value, price.value)
      : sell(props.code, m.name, qty.value, price.value)
  emit('toast', res.message)
  if (res.ok) close()
}
</script>

<template>
  <div class="bs-overlay" @click.self="close">
    <div class="bs-sheet" :class="{ open: shown }">
      <div class="bs-handle"></div>

      <div class="bs-header">
        <div class="sheet-title-wrap">
          <span class="bs-title">{{ meta.name }}</span>
          <span class="sheet-code">{{ code }} · {{ meta.sector }}</span>
        </div>
        <button class="bs-close" @click="close">✕</button>
      </div>

      <!-- 현재가 -->
      <div class="price-block">
        <span class="price-now">{{ price > 0 ? won(price) + '원' : '시세 조회 중…' }}</span>
        <span v-if="quote" class="price-chg" :class="changeClass">
          {{ quote.change > 0 ? '▲' : quote.change < 0 ? '▼' : '–' }}
          {{ won(Math.abs(quote.change)) }} ({{ pct(quote.changeRate) }})
        </span>
        <span v-if="quote && quote.marketStatus !== 'OPEN'" class="market-closed">장 마감 · 종가 기준</span>
      </div>

      <!-- 매수/매도 토글 -->
      <div class="seg">
        <button class="seg-btn" :class="{ 'seg-buy': mode === 'BUY' }" @click="mode = 'BUY'">매수</button>
        <button
          class="seg-btn"
          :class="{ 'seg-sell': mode === 'SELL' }"
          :disabled="maxSellQty === 0"
          @click="maxSellQty > 0 && (mode = 'SELL')"
        >
          매도
        </button>
      </div>

      <!-- 보유/현금 정보 -->
      <div class="mini-info">
        <template v-if="mode === 'BUY'">
          <span>보유 현금</span><strong>{{ won(state.cash) }}원</strong>
        </template>
        <template v-else>
          <span>보유 수량</span><strong>{{ won(maxSellQty) }}주</strong>
        </template>
      </div>

      <!-- 수량 스텝퍼 -->
      <div class="qty-row">
        <button class="qty-btn" @click="bump(-1)">−</button>
        <div class="qty-display">
          <span class="qty-num">{{ won(qty) }}</span>
          <span class="qty-unit">주</span>
        </div>
        <button class="qty-btn" @click="bump(1)">＋</button>
      </div>

      <!-- 비율 퀵버튼 -->
      <div class="pct-row">
        <button class="btn-outline-pill" @click="setPercent(10)">10%</button>
        <button class="btn-outline-pill" @click="setPercent(25)">25%</button>
        <button class="btn-outline-pill" @click="setPercent(50)">50%</button>
        <button class="btn-outline-pill" @click="setPercent(100)">최대</button>
      </div>

      <!-- 주문 요약 -->
      <div class="summary-card">
        <div class="sum-line">
          <span>주문 금액</span><span class="sum-strong">{{ won(amount) }}원</span>
        </div>
        <div class="sum-line">
          <span>주문 후 현금</span><span>{{ won(cashAfter) }}원</span>
        </div>
      </div>

      <button
        class="btn-primary"
        :class="{ 'btn-sell': mode === 'SELL' }"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ mode === 'BUY' ? '매수하기' : '매도하기' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.bs-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: flex-end;
  z-index: 200;
}
.bs-sheet {
  width: 100%; max-width: 480px; margin: 0 auto;
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 12px 16px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 1, 0.55, 1);
}
.bs-sheet.open { transform: translateY(0); }
.bs-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; }
.bs-header {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 0 2px;
}
.sheet-title-wrap { display: flex; flex-direction: column; gap: 2px; }
.bs-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
.sheet-code { font-size: 12px; color: var(--text-3); letter-spacing: -0.2px; }
.bs-close {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--muted-bg); border: 1px solid var(--border);
  font-size: 13px; color: var(--text-2);
  display: flex; align-items: center; justify-content: center;
}

.price-block { width: 100%; display: flex; flex-direction: column; gap: 3px; padding: 0 2px; }
.price-now { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
.price-chg { font-size: 14px; font-weight: 600; }
.market-closed { font-size: 12px; color: var(--text-3); }

.seg {
  width: 100%; display: flex; gap: 6px;
  background: var(--muted-bg); border-radius: 12px; padding: 4px;
}
.seg-btn {
  flex: 1; height: 40px; border: none; background: transparent;
  font-size: 15px; font-weight: 700; color: var(--text-3); border-radius: 9px;
  transition: background 0.15s, color 0.15s;
}
.seg-btn:disabled { color: #CBD0D8; }
.seg-btn.seg-buy { background: #fff; color: var(--up); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.seg-btn.seg-sell { background: #fff; color: var(--down); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

.mini-info {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; color: var(--text-2); padding: 0 4px;
}
.mini-info strong { color: var(--text-1); font-weight: 700; }

.qty-row { width: 100%; display: flex; align-items: center; gap: 12px; }
.qty-btn {
  width: 48px; height: 52px; flex-shrink: 0;
  border: 1.5px solid var(--border); background: #fff; border-radius: 12px;
  font-size: 24px; color: var(--text-1); line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.qty-btn:active { background: var(--muted-bg); }
.qty-display {
  flex: 1; height: 52px; border: 1.5px solid var(--border); border-radius: 12px;
  display: flex; align-items: baseline; justify-content: center; gap: 4px;
}
.qty-num { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
.qty-unit { font-size: 14px; color: var(--text-2); }

.pct-row { width: 100%; display: flex; gap: 6px; }
.pct-row .btn-outline-pill {
  flex: 1; height: 38px; padding: 0;
  background: var(--muted-bg); border: 1px solid var(--border);
  color: var(--text-2); font-size: 13px; font-weight: 600; border-radius: 9999px;
}
.pct-row .btn-outline-pill:active { background: var(--primary-200); color: var(--primary); }

.summary-card {
  width: 100%; background: var(--muted-bg); border-radius: 12px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
}
.sum-line { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--text-2); }
.sum-strong { font-size: 15px; font-weight: 700; color: var(--text-1); }

.btn-primary {
  width: 100%; height: 56px;
  background: var(--up); color: #fff;
  font-size: 16px; font-weight: 700; letter-spacing: -0.3px;
  border-radius: 12px; border: none;
}
.btn-primary:active { filter: brightness(0.92); }
.btn-primary:disabled { background: #D8DCE3; color: #fff; }
.btn-primary.btn-sell { background: var(--down); }
</style>
