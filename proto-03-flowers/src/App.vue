<template>
  <div class="app">
    <header class="header">
      <h1 class="display">🌸 화투 운세</h1>
      <p class="caption-1">하루의 운세를 점쳐보세요</p>
    </header>

    <main class="main">
      <!-- 주요 버튼 -->
      <button class="btn-primary" @click="drawFortune" :disabled="isAnimating">
        {{ isAnimating ? '점쳐 중...' : '운세 뽑기' }}
      </button>

      <!-- 오늘 운세 결과 -->
      <transition name="fade">
        <div v-if="todayFortune" class="card fortune-card">
          <div class="fortune-header">
            <span class="badge-primary">오늘의 운세</span>
            <span class="caption-2">{{ getTodayDate() }}</span>
          </div>

          <!-- 뽑은 카드 -->
          <div class="cards-display">
            <div v-for="(card, idx) in todayFortune.cards" :key="idx" class="flower-card" :class="`month-${card.month}`" :style="{ animationDelay: `${idx * 0.3}s` }">
              <div class="flower-card-top">
                <div class="flower-icon">{{ card.emoji }}</div>
              </div>
              <div class="flower-card-bottom">
                <p class="flower-month">{{ card.monthName }}</p>
                <p class="flower-type">{{ card.type }}</p>
              </div>
            </div>
          </div>

          <!-- 점괘 텍스트 -->
          <div class="fortune-text">
            <p class="body-1" v-for="(line, idx) in todayFortune.message.split('\n')" :key="idx">{{ line }}</p>
          </div>

          <!-- 복사 버튼 -->
          <button class="btn-secondary" @click="copyToClipboard">
            {{ copyState === 'copied' ? '✓ 복사되었습니다' : '📋 공유하기' }}
          </button>

          <!-- 이미 점쳐졌음 메시지 -->
          <p v-if="alreadyDrawnToday" class="caption-2 already-drawn">
            ✨ 이미 오늘의 운세를 점쳤습니다! 다시 뽑으면 새로운 운세를 확인할 수 있어요.
          </p>
        </div>
      </transition>

      <!-- 빈 상태 -->
      <div v-if="!todayFortune" class="empty-state">
        <div class="empty-icon">🎴</div>
        <p class="empty-text">버튼을 눌러 운세를 뽑아보세요</p>
      </div>
    </main>

    <!-- 이전 운세들 -->
    <section v-if="history.length > 1" class="history-section">
      <div class="history-header">
        <h2 class="title-4">지난 운세</h2>
        <button class="btn-text" @click="clearHistory">전체 삭제</button>
      </div>
      <div class="history-list">
        <div
          v-for="(entry, ei) in [...history].reverse().slice(1)"
          :key="ei"
          class="info-row-card"
        >
          <div class="history-date">
            <span class="caption-1">{{ entry.date }}</span>
          </div>
          <div class="history-cards">
            <div v-for="(card, ci) in entry.cards" :key="ci" class="card-mini" :class="`month-${card.month}`">
              {{ card.emoji }}
            </div>
          </div>
          <span class="caption-2">보기</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Card {
  month: number
  monthName: string
  type: string
  emoji: string
}

interface Fortune {
  cards: Card[]
  message: string
  date: string
}

const months = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
]

const monthEmojis = ['🎄', '🌸', '🌾', '🌷', '🌺', '🌹', '🎋', '🌻', '🌼', '🍂', '🍁', '❄️']

const cardTypes = ['광', '띠', '피', '알']

const fortuneMessages: { [key: string]: string[] } = {
  '1-1': ['새로운 시작의 기운이 감돕니다. 지금이 바로 새로운 도전을 할 때예요.', '꿈이 현실로 변할 준비가 되어 있습니다.'],
  '1-2': ['행운의 바람이 불고 있습니다. 평소 미루던 일을 시작해보세요.', '좋은 일들이 자연스럽게 따라올 것입니다.'],
  '1-3': ['건강과 행복이 함께합니다. 주변 사람들과 따뜻한 시간을 나누세요.', '가족과의 관계가 더욱 돈독해질 예감이 듭니다.'],
  '1-4': ['겨울을 견디는 소나무처럼 당신도 강해지고 있습니다.', '어려움은 잠시, 봄날의 햇빛 같은 기쁨이 기다리고 있어요.'],

  '2-1': ['사랑과 인연의 기운이 가득합니다. 누군가 당신을 생각하고 있을 수도?', '새로운 만남이 당신의 인생에 색을 더해줄 것입니다.'],
  '2-2': ['아름다운 것들에 둘러싸여 있습니다. 오감을 깨우고 감상해보세요.', '예술과 창작의 영감이 흘러넘칩니다.'],
  '2-3': ['봄의 에너지가 온몸에 퍼지고 있습니다. 뭔가 시작하기 좋은 날씨네요.', '계획했던 일들이 꽃 피울 준비 중입니다.'],
  '2-4': ['매화처럼 고고한 기품이 당신을 감싸고 있습니다.', '우아함과 정성이 빛나는 하루가 될 것 같아요.'],

  '3-1': ['행운의 신이 당신의 편입니다! 큰 기회가 들어올 예감이 듭니다.', '이 기회를 놓치지 마세요.'],
  '3-2': ['재물운이 톡톡 튀고 있습니다. 뜻밖의 기쁜 소식이 들릴 수도?', '당신의 노력이 보상받을 시간입니다.'],
  '3-3': ['횡재의 바람이 살살 불어옵니다. 운이 좋아지는 기분이네요.', '선택과 결정이 모두 좋은 방향으로 향하고 있습니다.'],
  '3-4': ['부의 문이 열리고 있는 신호입니다. 희망찬 변화를 기대하세요.', '인고의 시간이 끝나가고 있습니다.'],

  '4-1': ['당신의 정성과 노력이 하나둘 열매를 맺기 시작합니다.', '꾸준한 마음이 최고의 열매를 가져올 것입니다.'],
  '4-2': ['성실함이 당신을 감싸고 있습니다. 그 진심이 분명 통할 거예요.', '믿음과 신뢰로 단단한 관계가 만들어집니다.'],
  '4-3': ['노력하는 것만으로도 충분히 아름답습니다. 계속 나아가세요.', '목련처럼 당신은 차곡차곡 성장하고 있어요.'],
  '4-4': ['진정성이 통하는 날입니다. 마음 속 말을 꺼내보세요.', '당신의 절실함이 누군가의 마음을 움직일 겁니다.'],

  '5-1': ['깨끗한 마음이 모든 것을 정화하고 있습니다. 마음이 한결 가벼워질 거예요.', '새로운 시작을 위한 준비가 되고 있습니다.'],
  '5-2': ['순수한 마음이 당신을 가득 채우고 있습니다. 그대로가 최고입니다.', '본래의 모습이 가장 아름다웠단 걸 기억하세요.'],
  '5-3': ['깊은 물처럼 당신의 마음도 차분해지고 있습니다. 명상적인 기운이네요.', '혼돈 속에서도 정화되는 경험을 하게 될 것 같습니다.'],
  '5-4': ['창포처럼 향기로운 하루가 될 것 같습니다. 긍정의 기운으로 충만하네요.', '주변을 밝게 하는 당신의 에너지가 돋보입니다.'],

  '6-1': ['풍요로움이 당신을 감싸고 있습니다. 넉넉한 마음으로 나눠보세요.', '주는 것만큼 받을 준비가 되어 있습니다.'],
  '6-2': ['화려한 기운이 당신의 매력을 더해줄 것 같습니다. 자신감을 가져보세요.', '당신은 충분히 빛나고 있습니다.'],
  '6-3': ['축복받은 하루가 될 것 같습니다. 감사함으로 채워진 마음이네요.', '모든 게 잘될 거라는 믿음을 가져보세요.'],
  '6-4': ['모란처럼 활짝 핀 당신의 가능성이 드러날 때입니다. 자신을 믿으세요.', '당신의 시간이 온 것 같습니다.'],

  '7-1': ['격조 있는 당신의 모습이 돋보일 것 같습니다. 우아하게 행동해보세요.', '당신의 품격이 누군가를 감동시킬 거예요.'],
  '7-2': ['기품 있는 결정을 내리기 좋은 날씨입니다. 신중하되 당당하게요.', '당신의 선택은 늘 옳았습니다.'],
  '7-3': ['정중하고 따뜻한 당신이 빛나는 날입니다. 그 진심이 전해질 거예요.', '격식 없는 진심이 최고의 선물입니다.'],
  '7-4': ['가지가 곧게 자라는 것처럼 당신도 바른 길로 나아가고 있습니다.', '어떤 유혹도 당신의 흔들 수 없습니다.'],

  '8-1': ['영원히 당신과 함께할 것 같은 사람을 만날 징조입니다.', '깊고 오래가는 사랑의 기운이 감돕니다.'],
  '8-2': ['벚꽃이 피고 지는 것처럼 아름다운 순간을 놓치지 마세요.', '지금 이 순간이 가장 소중합니다.'],
  '8-3': ['기다리던 것이 드디어 열릴 것 같습니다. 조금만 더 기다려보세요.', '당신의 인내가 빛을 발할 시간이 왔습니다.'],
  '8-4': ['사랑과 우정 모두 깊어질 예감입니다. 소중한 사람들과 시간을 가져보세요.', '당신이 사랑할수록 당신도 사랑받을 것입니다.'],

  '9-1': ['지혜의 빛이 당신을 밝혀주고 있습니다. 차분하게 생각해보세요.', '깊은 사고가 좋은 결과를 만들어낼 것입니다.'],
  '9-2': ['은근한 행복이 당신을 감싸고 있습니다. 그것으로 충분합니다.', '화려하지 않지만 진한 만족감을 느낄 것 같아요.'],
  '9-3': ['장수의 기운처럼 당신의 인생도 길고 풍요로울 것입니다.', '현명한 선택으로 당신의 길을 닦아나가세요.'],
  '9-4': ['국화의 고고함이 당신을 감싸고 있습니다. 그대로의 당신이 최고입니다.', '어떤 시간도 당신의 가치를 떨어뜨릴 수 없습니다.'],

  '10-1': ['변화가 당신을 더 성숙하게 만들고 있습니다. 그 변화를 받아들이세요.', '당신은 지금 가장 좋은 시기를 맞이하고 있습니다.'],
  '10-2': ['깊이 있는 당신의 모습이 드러날 것 같습니다. 자신을 드러내보세요.', '내공이 쌓인 당신의 시간이 온 것 같습니다.'],
  '10-3': ['계절의 변화처럼 당신도 새로워지고 있습니다. 그 성장을 즐겨보세요.', '지금의 변화가 최고의 선물이 될 것입니다.'],
  '10-4': ['단풍처럼 화려하게 당신의 색깔을 드러낼 때입니다.', '당신의 개성이 가장 아름다운 표현이 될 것입니다.'],

  '11-1': ['부드러운 마음이 상황을 녹일 것입니다. 유연하게 대처해보세요.', '강해보일 필요 없습니다. 당신의 온기가 최고의 힘입니다.'],
  '11-2': ['회복의 시간으로 들어서고 있습니다. 자신을 다시 채워나가세요.', '쉬어도 괜찮습니다. 당신은 충분히 잘 하고 있습니다.'],
  '11-3': ['버들처럼 살랑대는 당신의 매력이 돋보일 것 같습니다.', '부드러움은 약함이 아닙니다. 그것은 강함입니다.'],
  '11-4': ['유연함이 최고의 무기가 되는 날입니다. 흐르는 물처럼 나아가세요.', '고집보다는 포용이 더 큰 승리를 가져올 것입니다.'],

  '12-1': ['겨울의 강함으로 무장한 당신입니다. 견디면 봄이 옵니다.', '이 시간도 당신을 더 강하게 만드는 과정입니다.'],
  '12-2': ['매처럼 절개 있는 당신의 모습이 빛날 것 같습니다. 원칙을 지키세요.', '타협하지 않는 당신이 가장 아름답습니다.'],
  '12-3': ['겨울밤하늘의 희망처럼 당신도 빛나고 있습니다. 포기하지 마세요.', '가장 어두울 때 별이 가장 밝게 빛납니다.'],
  '12-4': ['새해를 준비하는 마음처럼 당신도 다시 시작할 준비가 되어 있습니다.', '새로운 시작은 지금부터입니다. 용기를 내세요.'],
}

const todayFortune = ref<Fortune | null>(null)
const history = ref<Fortune[]>([])
const isAnimating = ref(false)
const alreadyDrawnToday = ref(false)
const copyState = ref<'idle' | 'copied'>('idle')

function getTodayDate(): string {
  const today = new Date()
  const month = today.getMonth() + 1
  const date = today.getDate()
  return `${month}월 ${date}일`
}

function getTodayKey(): string {
  const today = new Date()
  return `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
}

function getAllCards(): Card[] {
  const cards: Card[] = []
  for (let month = 0; month < 12; month++) {
    for (let typeIdx = 0; typeIdx < 4; typeIdx++) {
      cards.push({
        month: month + 1,
        monthName: months[month],
        type: cardTypes[typeIdx],
        emoji: monthEmojis[month],
      })
    }
  }
  return cards
}

function pickTwoCards(): Card[] {
  const allCards = getAllCards()
  const shuffled = [...allCards].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2)
}

function getFortuneMessage(card1: Card, card2: Card): string {
  const key = card1.month < card2.month
    ? `${card1.month}-${card2.month}`
    : card1.month === card2.month
      ? `${card1.month}-${card1.month}`
      : `${card2.month}-${card1.month}`

  const messages = fortuneMessages[key]
  if (!messages) {
    const defaultMessages = [
      '두 인연이 만나 새로운 이야기가 시작됩니다.',
      '서로 다른 에너지가 조화로워질 것 같습니다.',
    ]
    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)]
  }

  return messages[Math.floor(Math.random() * messages.length)]
}

async function drawFortune() {
  if (isAnimating.value) return

  isAnimating.value = true
  const today = getTodayKey()
  const storedToday = localStorage.getItem('fortune-date')
  const storedFortune = localStorage.getItem('fortune-today')

  if (storedToday === today && storedFortune) {
    const parsed = JSON.parse(storedFortune)
    todayFortune.value = parsed
    alreadyDrawnToday.value = true
    isAnimating.value = false
    return
  }

  await new Promise(res => setTimeout(res, 600))

  const cards = pickTwoCards()
  const message = getFortuneMessage(cards[0], cards[1])

  const fortune: Fortune = {
    cards,
    message,
    date: getTodayDate(),
  }

  todayFortune.value = fortune
  history.value.push(fortune)
  alreadyDrawnToday.value = false

  localStorage.setItem('fortune-date', today)
  localStorage.setItem('fortune-today', JSON.stringify(fortune))

  isAnimating.value = false
}

function copyToClipboard() {
  if (!todayFortune.value) return

  const text = `🌸 오늘의 화투 운세 - ${todayFortune.value.date}

🎴 ${todayFortune.value.cards[0].monthName} (${todayFortune.value.cards[0].type})
🎴 ${todayFortune.value.cards[1].monthName} (${todayFortune.value.cards[1].type})

✨ ${todayFortune.value.message}

화투 운세로 운을 나눠보세요 🌸`

  navigator.clipboard.writeText(text).then(() => {
    copyState.value = 'copied'
    setTimeout(() => {
      copyState.value = 'idle'
    }, 2000)
  })
}

function clearHistory() {
  if (confirm('지난 운세를 모두 삭제하시겠어요?')) {
    history.value = []
  }
}

function loadStoredFortune() {
  const today = getTodayKey()
  const storedToday = localStorage.getItem('fortune-date')
  const storedFortune = localStorage.getItem('fortune-today')

  if (storedToday === today && storedFortune) {
    const parsed = JSON.parse(storedFortune)
    todayFortune.value = parsed
    alreadyDrawnToday.value = true
  }
}

loadStoredFortune()
</script>

<style scoped>
.app {
  --primary:       #5F46FF;
  --primary-dark:  #4A35E0;
  --primary-light: #EEEAFF;
  --primary-200:   #F2F0FF;
  --card-bg:       #FFFFFF;
  --muted-bg:      #F5F5F8;
  --border:        #E5E7EB;
  --text-1:        #111827;
  --text-2:        #6B7280;
  --text-3:        #9CA3AF;
  --success:       #10B981;
  --error:         #EF4444;

  max-width: 480px;
  margin: 0 auto;
  padding: 32px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Typography */
.display {
  font-size: 36px; font-weight: 700;
  letter-spacing: -0.5px; color: var(--text-1);
}
.title-4 {
  font-size: 16px; font-weight: 700;
  letter-spacing: -0.3px; color: var(--text-1);
}
.body-1 {
  font-size: 15px; font-weight: 400;
  color: var(--text-1); line-height: 1.6;
}
.body-2 {
  font-size: 14px; font-weight: 400;
  color: var(--text-2);
}
.caption-1 {
  font-size: 13px; font-weight: 400;
  letter-spacing: -0.2px; color: var(--text-2);
}
.caption-2 {
  font-size: 12px; font-weight: 400;
  letter-spacing: -0.2px; color: var(--text-3);
}

/* Header */
.header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

/* Card */
.card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.fortune-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fortune-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

/* Cards Display */
.cards-display {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.flower-card {
  width: 100px;
  height: 140px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.6s cubic-bezier(.34, 1.56, .64, 1);
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  position: relative;
}

.flower-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 35px,
      rgba(255,255,255,.1) 35px,
      rgba(255,255,255,.1) 70px
    );
  pointer-events: none;
}

.flower-card-top {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  position: relative;
  z-index: 1;
}

.flower-icon {
  font-size: 40px;
  line-height: 1;
}

.flower-card-bottom {
  padding: 8px;
  text-align: center;
  background: rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 1;
}

.flower-month {
  font-size: 11px; font-weight: 700;
  color: var(--text-1);
  margin: 0;
}

.flower-type {
  font-size: 10px;
  color: var(--text-3);
  margin: 2px 0 0 0;
}

/* Month Colors */
.flower-card.month-1 { background: linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%); }
.flower-card.month-2 { background: linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%); }
.flower-card.month-3 { background: linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%); }
.flower-card.month-4 { background: linear-gradient(135deg, #E9D5FF 0%, #DDD6FE 100%); }
.flower-card.month-5 { background: linear-gradient(135deg, #DBEAFE 0%, #BAE6FD 100%); }
.flower-card.month-6 { background: linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%); }
.flower-card.month-7 { background: linear-gradient(135deg, #D8B4FE 0%, #C084FC 100%); }
.flower-card.month-8 { background: linear-gradient(135deg, #FBCFE8 0%, #F9A8D4 100%); }
.flower-card.month-9 { background: linear-gradient(135deg, #FDE047 0%, #FACC15 100%); }
.flower-card.month-10 { background: linear-gradient(135deg, #FDBA74 0%, #FB923C 100%); }
.flower-card.month-11 { background: linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%); }
.flower-card.month-12 { background: linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%); }

/* Fortune Text */
.fortune-text {
  padding: 12px;
  background: var(--primary-dim, rgba(95,70,255,0.10));
  border-radius: 12px;
  border-left: 3px solid var(--primary);
}

.fortune-text p {
  margin: 0;
}

.fortune-text p + p {
  margin-top: 8px;
}

/* Badge */
.badge-primary {
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 6px;
}

/* Buttons */
.btn-primary {
  width: 100%;
  height: 56px;
  background: var(--primary);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  font-family: inherit;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}

.btn-primary:active:not(:disabled) {
  background: var(--primary-dark);
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-secondary {
  width: 100%;
  height: 48px;
  background: var(--primary-200);
  color: var(--primary);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
  font-family: inherit;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}

.btn-secondary:active {
  background: var(--primary-light);
}

.btn-text {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  padding: 0 4px;
}

/* Already Drawn Message */
.already-drawn {
  color: var(--text-3);
  text-align: center;
  line-height: 1.5;
}

/* Main */
.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px 40px;
  gap: 10px;
}

.empty-icon {
  font-size: 56px;
  opacity: 0.25;
}

.empty-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-2);
}

/* History */
.history-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.history-date {
  min-width: 60px;
}

.history-cards {
  flex: 1;
  display: flex;
  gap: 8px;
}

.card-mini {
  width: 48px;
  height: 68px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.card-mini::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 25px,
      rgba(255,255,255,.08) 25px,
      rgba(255,255,255,.08) 50px
    );
  pointer-events: none;
}

.card-mini {
  z-index: 1;
}

/* Mini Card Month Colors */
.card-mini.month-1 { background: linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%); }
.card-mini.month-2 { background: linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%); }
.card-mini.month-3 { background: linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%); }
.card-mini.month-4 { background: linear-gradient(135deg, #E9D5FF 0%, #DDD6FE 100%); }
.card-mini.month-5 { background: linear-gradient(135deg, #DBEAFE 0%, #BAE6FD 100%); }
.card-mini.month-6 { background: linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%); }
.card-mini.month-7 { background: linear-gradient(135deg, #D8B4FE 0%, #C084FC 100%); }
.card-mini.month-8 { background: linear-gradient(135deg, #FBCFE8 0%, #F9A8D4 100%); }
.card-mini.month-9 { background: linear-gradient(135deg, #FDE047 0%, #FACC15 100%); }
.card-mini.month-10 { background: linear-gradient(135deg, #FDBA74 0%, #FB923C 100%); }
.card-mini.month-11 { background: linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%); }
.card-mini.month-12 { background: linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%); }

/* Animations */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-leave-to {
  opacity: 0;
}
</style>
