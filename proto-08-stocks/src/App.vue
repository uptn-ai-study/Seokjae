<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  state, prices, priceOf, updatePrices, resetSession,
  totalAsset, totalPL, totalReturnRate, evalPL, stockValue, holdingCodes,
} from './store'
import { getQuotes } from './api'
import { KOSPI100, CODE_TO_META, ALL_CODES, SECTORS } from './data/kospi100'
import { won, eok, pct } from './format'
import TradeSheet from './components/TradeSheet.vue'

type Tab = 'PORTFOLIO' | 'EXPLORE'
const tab = ref<Tab>('PORTFOLIO')

const search = ref('')
const sector = ref<string>('전체')

// 매매 시트
const sheetCode = ref<string | null>(null)
const sheetMode = ref<'BUY' | 'SELL'>('BUY')
function openTrade(code: string, mode: 'BUY' | 'SELL') {
  sheetCode.value = code
  sheetMode.value = mode
}

// 토스트
const toast = ref('')
let toastTimer: number | undefined
function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2200)
}

// 면책 고지 인트로 (최초 1회)
const introSeen = ref(localStorage.getItem('proto08-intro') === '1')
function closeIntro() {
  introSeen.value = true
  localStorage.setItem('proto08-intro', '1')
}

// 초기화 확인
const confirmReset = ref(false)
function doReset() {
  resetSession()
  confirmReset.value = false
  tab.value = 'PORTFOLIO'
  showToast('새 세션 시작 · 시드머니 10억 지급')
}

// ── 시세 폴링 ───────────────────────────────────────────────
const loading = ref(true)
const fetchError = ref(false)
let pollTimer: number | undefined

async function poll() {
  try {
    const quotes = await getQuotes(ALL_CODES)
    updatePrices(quotes)
    fetchError.value = false
  } catch {
    fetchError.value = true
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  poll()
  pollTimer = window.setInterval(poll, 7000)
})
onUnmounted(() => clearInterval(pollTimer))

// ── 탐색 목록 ───────────────────────────────────────────────
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return KOSPI100.filter((s) => {
    if (sector.value !== '전체' && s.sector !== sector.value) return false
    if (q && !s.name.toLowerCase().includes(q) && !s.code.includes(q)) return false
    return true
  })
})

// ── 보유 종목 행 데이터 ─────────────────────────────────────
interface HoldRow {
  code: string; name: string; qty: number; avgPrice: number
  cur: number; value: number; pl: number; plRate: number
}
const holdRows = computed<HoldRow[]>(() =>
  holdingCodes.value
    .map((code) => {
      const h = state.holdings[code]
      const cur = priceOf(code)
      const value = h.qty * cur
      const cost = h.qty * h.avgPrice
      const pl = value - cost
      return {
        code,
        name: CODE_TO_META[code]?.name ?? code,
        qty: h.qty,
        avgPrice: h.avgPrice,
        cur,
        value,
        pl,
        plRate: cost > 0 ? (pl / cost) * 100 : 0,
      }
    })
    .sort((a, b) => b.value - a.value),
)

function dirClass(n: number) {
  return n > 0 ? 'c-up' : n < 0 ? 'c-down' : 'c-flat'
}
function arrow(n: number) {
  return n > 0 ? '▲' : n < 0 ? '▼' : '–'
}
</script>

<template>
  <div class="phone">
    <!-- 헤더 -->
    <header class="app-header">
      <div class="header-top">
        <div class="brand">
          <span class="brand-emoji">📈</span>
          <span class="brand-name">모의투자 플레이</span>
        </div>
        <button class="reset-btn" @click="confirmReset = true">↻ 초기화</button>
      </div>

      <!-- 자산 요약 -->
      <div class="asset-summary">
        <span class="asset-label">총 자산</span>
        <span class="asset-total">{{ won(totalAsset) }}<span class="won-unit">원</span></span>
        <div class="asset-pl">
          <span :class="dirClass(totalPL)">
            {{ arrow(totalPL) }} {{ eok(Math.abs(totalPL)) }} ({{ pct(totalReturnRate) }})
          </span>
        </div>
      </div>

      <!-- 보조 지표 -->
      <div class="sub-metrics">
        <div class="metric">
          <span class="m-label">보유 현금</span>
          <span class="m-value">{{ eok(state.cash) }}</span>
        </div>
        <div class="metric">
          <span class="m-label">주식 평가</span>
          <span class="m-value">{{ eok(stockValue) }}</span>
        </div>
        <div class="metric">
          <span class="m-label">평가손익</span>
          <span class="m-value" :class="dirClass(evalPL)">{{ pct(holdingCodes.length ? (evalPL / (stockValue - evalPL || 1)) * 100 : 0) }}</span>
        </div>
      </div>
    </header>

    <!-- 탭 -->
    <nav class="top-tabs">
      <button class="top-tab" :class="{ active: tab === 'PORTFOLIO' }" @click="tab = 'PORTFOLIO'">
        내 투자<span v-if="holdingCodes.length" class="tab-badge">{{ holdingCodes.length }}</span>
      </button>
      <button class="top-tab" :class="{ active: tab === 'EXPLORE' }" @click="tab = 'EXPLORE'">
        종목 탐색
      </button>
    </nav>

    <!-- 시세 상태 줄 -->
    <div v-if="fetchError" class="feed-state err">⚠️ 시세를 불러오지 못했어요. 잠시 후 자동 재시도합니다.</div>

    <!-- ───────── 포트폴리오 ───────── -->
    <main v-if="tab === 'PORTFOLIO'" class="scroll-y body">
      <div v-if="holdRows.length === 0" class="empty-state">
        <div class="empty-icon">💸</div>
        <div class="empty-text">아직 보유한 종목이 없어요</div>
        <p class="empty-sub">시드머니 10억으로 KOSPI 100 종목에<br />지금 바로 투자해볼까요?</p>
        <button class="btn-go-explore" @click="tab = 'EXPLORE'">종목 탐색하러 가기</button>
      </div>

      <template v-else>
        <div
          v-for="r in holdRows"
          :key="r.code"
          class="hold-card"
          @click="openTrade(r.code, 'SELL')"
        >
          <div class="hold-main">
            <div class="hold-left">
              <div class="hold-name">{{ r.name }}</div>
              <div class="hold-qty">{{ won(r.qty) }}주 · 평단 {{ won(r.avgPrice) }}</div>
            </div>
            <div class="hold-right">
              <div class="hold-value">{{ won(r.value) }}원</div>
              <div class="hold-pl" :class="dirClass(r.pl)">
                {{ arrow(r.pl) }} {{ won(Math.abs(r.pl)) }} ({{ pct(r.plRate) }})
              </div>
            </div>
          </div>
          <div class="hold-foot">
            <span class="hold-cur">현재가 {{ won(r.cur) }}원</span>
            <div class="hold-actions">
              <button class="mini-btn buy" @click.stop="openTrade(r.code, 'BUY')">매수</button>
              <button class="mini-btn sell" @click.stop="openTrade(r.code, 'SELL')">매도</button>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- ───────── 종목 탐색 ───────── -->
    <main v-else class="body explore">
      <div class="search-wrap">
        <input v-model="search" class="input-field" placeholder="종목명 또는 코드 검색" />
        <span class="search-ico">🔎</span>
      </div>

      <div class="chips scroll-x">
        <button
          v-for="s in SECTORS"
          :key="s"
          class="chip"
          :class="{ active: sector === s }"
          @click="sector = s"
        >
          {{ s }}
        </button>
      </div>

      <div class="scroll-y explore-list">
        <div v-if="loading && filtered.length && !prices[filtered[0].code]" class="feed-state">
          실시간 시세를 불러오는 중…
        </div>
        <div
          v-for="s in filtered"
          :key="s.code"
          class="stock-row"
          @click="openTrade(s.code, 'BUY')"
        >
          <div class="stock-thumb">{{ s.name.slice(0, 1) }}</div>
          <div class="stock-info">
            <div class="stock-name">{{ s.name }}</div>
            <div class="stock-sub">{{ s.code }} · {{ s.sector }}</div>
          </div>
          <div class="stock-price">
            <div class="sp-now">{{ prices[s.code] ? won(prices[s.code].price) : '—' }}</div>
            <div v-if="prices[s.code]" class="sp-chg" :class="dirClass(prices[s.code].changeRate)">
              {{ arrow(prices[s.code].change) }} {{ pct(prices[s.code].changeRate) }}
            </div>
          </div>
        </div>
        <div v-if="filtered.length === 0" class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">검색 결과가 없어요</div>
        </div>
      </div>
    </main>

    <!-- 하단 면책 배너 -->
    <footer class="disclaimer-bar">
      ⚠️ 실제 돈이 아닌 <b>가상 모의투자</b>입니다. 투자 권유가 아니며 시세는 약 7초 지연될 수 있어요.
    </footer>

    <!-- 매매 바텀시트 -->
    <TradeSheet
      v-if="sheetCode"
      :code="sheetCode"
      :initial-mode="sheetMode"
      @close="sheetCode = null"
      @toast="showToast"
    />

    <!-- 토스트 -->
    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <!-- 초기화 확인 -->
    <div v-if="confirmReset" class="modal-overlay" @click.self="confirmReset = false">
      <div class="modal-card">
        <h3 class="modal-title">세션을 초기화할까요?</h3>
        <p class="modal-desc">보유 종목과 거래내역이 모두 사라지고<br />시드머니 10억으로 새로 시작합니다.</p>
        <div class="btn-row">
          <button class="btn-gray" @click="confirmReset = false">취소</button>
          <button class="btn-primary-md danger" @click="doReset">초기화</button>
        </div>
      </div>
    </div>

    <!-- 인트로 면책 모달 -->
    <div v-if="!introSeen" class="modal-overlay">
      <div class="modal-card intro">
        <div class="intro-emoji">📈🎮</div>
        <h3 class="modal-title">모의투자 플레이에 오신 걸 환영해요</h3>
        <p class="modal-desc intro-desc">
          KOSPI 100 종목의 <b>실시간 시세</b>를 바탕으로<br />
          시드머니 <b>10억 원</b>을 굴려보는 가상 투자 놀이예요.
        </p>
        <div class="intro-warn">
          ⚠️ <b>실제 돈이 오가지 않는 가상 투자</b>입니다.<br />
          투자 권유·수익 보장이 아니며, 실제 투자 판단의 근거로 삼지 마세요.
        </div>
        <button class="btn-primary" @click="closeIntro">10억으로 시작하기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body { flex: 1; min-height: 0; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; }

/* 헤더 */
.app-header {
  background: linear-gradient(160deg, #5F46FF 0%, #4A35E0 100%);
  color: #fff;
  padding: 14px 16px 16px;
  flex-shrink: 0;
}
.header-top { display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 6px; }
.brand-emoji { font-size: 18px; }
.brand-name { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
.reset-btn {
  background: rgba(255, 255, 255, 0.16); color: #fff; border: none;
  font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 9999px;
}
.reset-btn:active { background: rgba(255, 255, 255, 0.28); }

.asset-summary { margin-top: 14px; display: flex; flex-direction: column; gap: 2px; }
.asset-label { font-size: 12px; opacity: 0.8; letter-spacing: -0.2px; }
.asset-total { font-size: 30px; font-weight: 700; letter-spacing: -0.6px; }
.won-unit { font-size: 17px; font-weight: 600; margin-left: 2px; }
.asset-pl { font-size: 14px; font-weight: 700; margin-top: 1px; }
/* 헤더 위에서는 상승/하락 색을 흰 배경 대비 밝게 */
.asset-pl .c-up { color: #FFD2D2; }
.asset-pl .c-down { color: #C9DBFF; }
.asset-pl .c-flat { color: rgba(255,255,255,0.85); }

.sub-metrics {
  margin-top: 14px; display: flex; gap: 8px;
  background: rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 10px 4px;
}
.metric { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.m-label { font-size: 11px; opacity: 0.78; }
.m-value { font-size: 13px; font-weight: 700; letter-spacing: -0.2px; }
.sub-metrics .c-up { color: #FFD2D2; }
.sub-metrics .c-down { color: #C9DBFF; }

/* 탭 */
.top-tabs {
  height: 46px; display: flex; background: #fff;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.top-tab {
  flex: 1; border: none; background: none;
  font-size: 15px; font-weight: 400; color: var(--text-3); position: relative;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.top-tab.active { font-weight: 700; color: var(--text-1); }
.top-tab.active::after {
  content: ''; position: absolute; bottom: 0; left: 18%; right: 18%;
  height: 2px; background: var(--text-1); border-radius: 2px 2px 0 0;
}
.tab-badge {
  background: var(--primary); color: #fff; font-size: 11px; font-weight: 700;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center;
}

.feed-state { font-size: 12px; color: var(--text-3); text-align: center; padding: 8px; }
.feed-state.err { color: var(--error); background: #FEF2F2; }

/* 보유 카드 */
.hold-card {
  background: #fff; border-radius: 16px; padding: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); display: flex; flex-direction: column; gap: 10px;
}
.hold-card:active { background: #FAFAFD; }
.hold-main { display: flex; align-items: flex-start; justify-content: space-between; }
.hold-name { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
.hold-qty { font-size: 12px; color: var(--text-2); margin-top: 3px; }
.hold-right { text-align: right; }
.hold-value { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
.hold-pl { font-size: 12px; font-weight: 600; margin-top: 3px; }
.hold-foot {
  display: flex; align-items: center; justify-content: space-between;
  border-top: 1px solid #F3F4F6; padding-top: 10px;
}
.hold-cur { font-size: 12px; color: var(--text-2); }
.hold-actions { display: flex; gap: 6px; }
.mini-btn {
  height: 32px; padding: 0 16px; border-radius: 9999px; border: none;
  font-size: 13px; font-weight: 700;
}
.mini-btn.buy { background: #FDECEC; color: var(--up); }
.mini-btn.sell { background: #E9F0FF; color: var(--down); }

/* 탐색 */
.explore { padding-bottom: 0; gap: 10px; }
.search-wrap { position: relative; flex-shrink: 0; }
.search-wrap .input-field {
  width: 100%; height: 48px; padding: 0 16px 0 42px;
  background: #fff; border: 1.5px solid var(--border); border-radius: 12px;
  font-size: 15px; color: var(--text-1); outline: none;
}
.search-wrap .input-field:focus { border: 2px solid var(--primary); }
.search-ico { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); font-size: 15px; opacity: 0.6; }

.chips { display: flex; gap: 7px; overflow-x: auto; flex-shrink: 0; padding-bottom: 2px; }
.chip {
  flex-shrink: 0; border: 1.5px solid var(--primary); color: var(--primary);
  font-size: 13px; font-weight: 500; border-radius: 9999px; padding: 6px 13px;
  background: transparent; white-space: nowrap;
}
.chip.active { background: var(--primary); color: #fff; }

.explore-list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.stock-row {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 14px; padding: 12px 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}
.stock-row:active { background: #FAFAFD; }
.stock-thumb {
  width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
  background: var(--primary-light); color: var(--primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; font-weight: 700;
}
.stock-info { flex: 1; min-width: 0; }
.stock-name { font-size: 15px; font-weight: 600; letter-spacing: -0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stock-sub { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.stock-price { text-align: right; flex-shrink: 0; }
.sp-now { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; }
.sp-chg { font-size: 12px; font-weight: 600; margin-top: 2px; }

/* 빈 상태 */
.empty-state {
  display: flex; flex-direction: column; align-items: center; padding: 46px 20px; gap: 8px; margin: auto 0;
}
.empty-icon { font-size: 46px; opacity: 0.4; }
.empty-text { font-size: 16px; font-weight: 700; color: var(--text-2); }
.empty-sub { font-size: 13px; color: var(--text-3); text-align: center; line-height: 1.55; }
.btn-go-explore {
  margin-top: 8px; height: 48px; padding: 0 24px;
  background: var(--primary); color: #fff; border: none; border-radius: 12px;
  font-size: 15px; font-weight: 700;
}
.btn-go-explore:active { background: var(--primary-dark); }

/* 면책 배너 */
.disclaimer-bar {
  flex-shrink: 0; background: #FFF8E6; color: #8A6D00;
  font-size: 11px; line-height: 1.4; text-align: center;
  padding: 8px 14px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid #F2E6BD;
}
.disclaimer-bar b { font-weight: 700; }

/* 토스트 */
.toast {
  position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%);
  background: rgba(17, 24, 39, 0.94); color: #fff;
  font-size: 13px; font-weight: 600; padding: 11px 18px; border-radius: 9999px;
  z-index: 300; white-space: nowrap; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

/* 모달 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 28px; z-index: 250;
}
.modal-card {
  width: 100%; max-width: 340px; background: #fff; border-radius: 20px;
  padding: 24px 22px; display: flex; flex-direction: column; gap: 10px; text-align: center;
}
.modal-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
.modal-desc { font-size: 14px; color: var(--text-2); line-height: 1.55; }
.modal-card .btn-row { display: flex; gap: 10px; margin-top: 8px; }
.btn-gray {
  flex: 1; height: 48px; background: var(--muted-bg); color: var(--text-2);
  border: 1px solid var(--border); font-size: 15px; font-weight: 600; border-radius: 12px;
}
.btn-primary-md {
  flex: 1; height: 48px; background: var(--primary); color: #fff; border: none;
  font-size: 15px; font-weight: 700; border-radius: 12px;
}
.btn-primary-md.danger { background: var(--error); }
.btn-primary-md.danger:active { filter: brightness(0.92); }

.modal-card.intro { gap: 12px; padding: 28px 22px; }
.intro-emoji { font-size: 40px; }
.intro-desc { margin-top: 2px; }
.intro-warn {
  background: #FFF8E6; color: #8A6D00; font-size: 12.5px; line-height: 1.5;
  border-radius: 12px; padding: 12px 14px; border: 1px solid #F2E6BD;
}
.intro .btn-primary {
  width: 100%; height: 54px; margin-top: 4px;
  background: var(--primary); color: #fff; border: none; border-radius: 12px;
  font-size: 16px; font-weight: 700;
}
.intro .btn-primary:active { background: var(--primary-dark); }
</style>
