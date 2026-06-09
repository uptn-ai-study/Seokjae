<template>
  <svg
    class="hwatu"
    :width="width"
    :height="height"
    viewBox="0 0 100 150"
    role="img"
    :aria-label="back ? '화투 뒷면' : `${month}월 화투`"
  >
    <defs>
      <clipPath :id="`clip-${uid}`">
        <rect x="3" y="3" width="94" height="144" rx="9" />
      </clipPath>
    </defs>

    <!-- 카드 바탕 -->
    <rect x="3" y="3" width="94" height="144" rx="9" :fill="back ? '#1E1A22' : pal.bg" />

    <!-- 모티프 영역 (프레임 안쪽으로 클립) -->
    <g :clip-path="`url(#clip-${uid})`">
      <!-- ── 뒷면 ── -->
      <g v-if="back" :stroke="'#C9A84C'" fill="none" stroke-width="1" opacity="0.7">
        <circle cx="50" cy="40" r="10" />
        <circle cx="50" cy="40" r="18" />
        <circle cx="22" cy="95" r="10" />
        <circle cx="22" cy="95" r="18" />
        <circle cx="78" cy="95" r="10" />
        <circle cx="78" cy="95" r="18" />
      </g>
      <circle v-if="back" cx="50" cy="75" r="6" fill="#C9A84C" opacity="0.85" />

      <!-- ── 1월 송학 ── -->
      <g v-else-if="month === 1">
        <circle cx="64" cy="42" r="13" fill="#C8202E" />
        <path d="M28 116 L48 74 L68 116 Z" fill="#1E5E45" />
        <path d="M22 132 L48 84 L74 132 Z" fill="#2A7C5C" />
        <rect x="45" y="120" width="6" height="16" fill="#5A3A24" />
        <path d="M30 56 q8 -6 16 0" :stroke="ink" stroke-width="1.6" fill="none" stroke-linecap="round" />
      </g>

      <!-- ── 2월 매조 ── -->
      <g v-else-if="month === 2">
        <path d="M20 122 Q46 96 80 50" fill="none" stroke="#6B4A2B" stroke-width="3" stroke-linecap="round" />
        <g v-for="(p, i) in plum" :key="i">
          <circle v-for="(o, j) in petals" :key="j" :cx="p[0] + o.x" :cy="p[1] + o.y" r="3.4" :fill="ink" />
          <circle :cx="p[0]" :cy="p[1]" r="1.8" fill="#C8202E" />
        </g>
      </g>

      <!-- ── 3월 벚꽃 ── -->
      <g v-else-if="month === 3">
        <rect x="6" y="14" width="88" height="11" :fill="pal.gold" opacity="0.9" />
        <g stroke="#7A1622" stroke-width="2">
          <line x1="22" y1="14" x2="22" y2="25" />
          <line x1="40" y1="14" x2="40" y2="25" />
          <line x1="58" y1="14" x2="58" y2="25" />
          <line x1="76" y1="14" x2="76" y2="25" />
        </g>
        <path d="M30 124 Q50 104 70 70" fill="none" stroke="#6B4A2B" stroke-width="2.5" stroke-linecap="round" />
        <g v-for="(p, i) in cherry" :key="i">
          <circle v-for="(o, j) in petals" :key="j" :cx="p[0] + o.x" :cy="p[1] + o.y" r="3.4" fill="#F4C9D2" />
          <circle :cx="p[0]" :cy="p[1]" r="1.7" fill="#C8202E" />
        </g>
      </g>

      <!-- ── 4월 흑싸리(등나무) ── -->
      <g v-else-if="month === 4">
        <path d="M50 12 Q42 60 52 122" fill="none" :stroke="pal.gold" stroke-width="1.5" />
        <g v-for="(c, i) in wis" :key="i">
          <circle v-for="(o, j) in wisOff" :key="j" :cx="c[0] + o[0]" :cy="c[1] + o[1]" r="3.2" fill="#9472C0" />
          <circle :cx="c[0]" :cy="c[1] + 15" r="2.2" fill="#7E5BA8" />
        </g>
      </g>

      <!-- ── 5월 난초(붓꽃) ── -->
      <g v-else-if="month === 5">
        <g fill="none" stroke="#2E7D52" stroke-width="3" stroke-linecap="round">
          <path d="M50 130 Q34 84 28 42" />
          <path d="M50 130 Q50 80 53 34" />
          <path d="M50 130 Q64 86 74 48" />
        </g>
        <g v-for="(o, j) in petals" :key="j">
          <ellipse :cx="52 + o.x" :cy="40 + o.y" rx="3" ry="5" fill="#8E6FB8" />
        </g>
        <circle cx="52" cy="40" r="2" :fill="pal.gold" />
      </g>

      <!-- ── 6월 모란 + 나비 ── -->
      <g v-else-if="month === 6">
        <circle cx="44" cy="84" r="15" fill="#8E1530" />
        <circle cx="44" cy="84" r="10" fill="#C8324A" />
        <circle cx="44" cy="84" r="5" fill="#F4C9D2" />
        <g fill="#2E7D52">
          <path d="M30 100 q-8 6 -2 12 q8 -2 6 -10 Z" />
        </g>
        <!-- 나비 -->
        <g transform="translate(72 42)">
          <ellipse cx="-4" cy="-3" rx="5" ry="4" :fill="pal.gold" />
          <ellipse cx="4" cy="-3" rx="5" ry="4" :fill="pal.gold" />
          <ellipse cx="-4" cy="4" rx="4" ry="3" fill="#E7C76B" />
          <ellipse cx="4" cy="4" rx="4" ry="3" fill="#E7C76B" />
          <line x1="0" y1="-5" x2="0" y2="6" :stroke="ink" stroke-width="1.4" />
        </g>
      </g>

      <!-- ── 7월 홍싸리 + 멧돼지 ── -->
      <g v-else-if="month === 7">
        <g fill="#C8324A">
          <circle cx="36" cy="36" r="3" /><circle cx="42" cy="40" r="3" /><circle cx="38" cy="44" r="3" />
          <circle cx="60" cy="30" r="3" /><circle cx="66" cy="34" r="3" /><circle cx="62" cy="38" r="3" />
        </g>
        <!-- 멧돼지 -->
        <g transform="translate(50 104)">
          <ellipse cx="0" cy="0" rx="20" ry="11" fill="#191015" />
          <path d="M-18 -2 q-8 -1 -11 5 q6 3 12 0 Z" fill="#191015" />
          <circle cx="-24" cy="2" r="1.4" :fill="pal.gold" />
          <path d="M-27 6 l-4 2" :stroke="ink" stroke-width="1.4" stroke-linecap="round" />
          <g :stroke="'#191015'" stroke-width="4" stroke-linecap="round">
            <line x1="-8" y1="9" x2="-9" y2="18" /><line x1="6" y1="9" x2="7" y2="18" />
          </g>
        </g>
      </g>

      <!-- ── 8월 공산(달·억새·기러기) ── -->
      <g v-else-if="month === 8">
        <circle cx="50" cy="50" r="21" fill="#E8D589" />
        <g fill="none" stroke="#C9BE8C" stroke-width="2" stroke-linecap="round">
          <path d="M30 132 Q34 104 30 88" /><path d="M42 132 Q44 100 42 84" />
          <path d="M58 132 Q56 100 58 84" /><path d="M70 132 Q66 104 70 88" />
        </g>
        <g fill="none" :stroke="ink" stroke-width="1.6" stroke-linecap="round" opacity="0.8">
          <path d="M40 34 l4 3 l4 -3" /><path d="M54 28 l4 3 l4 -3" />
        </g>
      </g>

      <!-- ── 9월 국화 + 술잔 ── -->
      <g v-else-if="month === 9">
        <g>
          <ellipse
            v-for="a in chrys"
            :key="a"
            cx="50" cy="50" rx="3" ry="9"
            :fill="a % 60 === 0 ? pal.gold : '#F0DFA0'"
            :transform="`rotate(${a} 50 62)`"
          />
        </g>
        <circle cx="50" cy="62" r="5" fill="#C8202E" />
        <!-- 술잔 -->
        <g transform="translate(50 116)">
          <path d="M-10 -6 L10 -6 L7 6 L-7 6 Z" :fill="pal.gold" />
          <path d="M-8 -6 L8 -6 L7 -2 L-7 -2 Z" fill="#C8202E" />
        </g>
      </g>

      <!-- ── 10월 단풍 + 사슴 ── -->
      <g v-else-if="month === 10">
        <path :d="maple" transform="translate(34 44) scale(1.5)" fill="#C8202E" />
        <path :d="maple" transform="translate(66 38) scale(1.1)" fill="#E0612A" />
        <path :d="maple" transform="translate(60 70) scale(1.2)" fill="#D8451F" />
        <!-- 사슴 -->
        <g transform="translate(46 110)">
          <ellipse cx="0" cy="0" rx="15" ry="8" fill="#3A2118" />
          <rect x="11" y="-12" width="5" height="12" rx="2" fill="#3A2118" />
          <ellipse cx="15" cy="-14" rx="5" ry="4" fill="#3A2118" />
          <g :stroke="'#3A2118'" stroke-width="2.2" stroke-linecap="round">
            <line x1="15" y1="-17" x2="12" y2="-24" /><line x1="17" y1="-17" x2="20" y2="-24" />
            <line x1="-7" y1="7" x2="-8" y2="15" /><line x1="6" y1="7" x2="7" y2="15" />
          </g>
        </g>
      </g>

      <!-- ── 11월 오동 + 봉황 ── -->
      <g v-else-if="month === 11">
        <ellipse cx="30" cy="58" rx="13" ry="20" fill="#2E6B52" transform="rotate(-20 30 58)" />
        <ellipse cx="68" cy="50" rx="11" ry="17" fill="#3A8064" transform="rotate(18 68 50)" />
        <!-- 봉황 -->
        <g transform="translate(50 96)">
          <path d="M-14 6 Q4 -14 22 -18 Q10 -6 20 0 Q6 0 12 12 Q0 2 -6 16 Q-10 4 -14 6 Z" :fill="pal.gold" />
          <circle cx="20" cy="-15" r="2" fill="#C8202E" />
          <path d="M-14 6 q-10 8 -18 6" :stroke="pal.gold" stroke-width="2" fill="none" stroke-linecap="round" />
        </g>
      </g>

      <!-- ── 12월 비(버드나무·소나기·번개) ── -->
      <g v-else-if="month === 12">
        <circle cx="38" cy="22" r="6" fill="#3A6B4E" />
        <g fill="none" stroke="#3A6B4E" stroke-width="2.2" stroke-linecap="round">
          <path d="M38 26 Q30 60 34 96" /><path d="M38 26 Q42 58 40 100" />
          <path d="M38 26 Q50 56 56 92" />
        </g>
        <g :stroke="ink" stroke-width="1.4" stroke-linecap="round" opacity="0.7">
          <line x1="60" y1="40" x2="54" y2="56" /><line x1="70" y1="46" x2="64" y2="62" />
          <line x1="78" y1="54" x2="72" y2="70" />
        </g>
        <polyline points="66,30 60,52 70,52 62,80" fill="none" :stroke="pal.gold" stroke-width="2.4" stroke-linejoin="round" />
      </g>
    </g>

    <!-- 프레임 테두리 -->
    <rect x="3" y="3" width="94" height="144" rx="9" fill="none" stroke="#14110F" stroke-width="2.5" />
    <rect x="8" y="8" width="84" height="134" rx="6" fill="none" :stroke="back ? '#C9A84C' : pal.gold" stroke-width="1" opacity="0.85" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ month?: number; w?: number; back?: boolean }>()

const uid = Math.random().toString(36).slice(2, 8)
const width = computed(() => props.w ?? 96)
const height = computed(() => (props.w ?? 96) * 1.5)
const ink = '#F4ECDB'

const PALETTES: Record<number, { bg: string; gold: string }> = {
  1: { bg: '#15392B', gold: '#D8B45A' },
  2: { bg: '#7A1622', gold: '#E7C66B' },
  3: { bg: '#A83246', gold: '#F0D27A' },
  4: { bg: '#2A2333', gold: '#C9A65A' },
  5: { bg: '#3A2B54', gold: '#D2B36A' },
  6: { bg: '#6E1226', gold: '#E7C76B' },
  7: { bg: '#2C1B23', gold: '#C99A5A' },
  8: { bg: '#15243F', gold: '#E8D589' },
  9: { bg: '#2C2622', gold: '#E5C76B' },
  10: { bg: '#3C1F1A', gold: '#E0A45A' },
  11: { bg: '#241F2E', gold: '#CDAF6A' },
  12: { bg: '#1B2730', gold: '#C9C06A' },
}

const pal = computed(() => (props.month ? PALETTES[props.month] : PALETTES[1]) ?? PALETTES[1])

// 꽃잎 5장 오프셋
const petals = [0, 72, 144, 216, 288].map((a) => ({
  x: +(Math.cos((a * Math.PI) / 180) * 4.3).toFixed(2),
  y: +(Math.sin((a * Math.PI) / 180) * 4.3).toFixed(2),
}))

const plum: number[][] = [[40, 92], [57, 74], [74, 54]]
const cherry: number[][] = [[34, 72], [54, 60], [72, 74], [46, 92], [66, 92]]
const wis: number[][] = [[40, 46], [60, 66], [44, 92]]
const wisOff: number[][] = [[0, 0], [-3.4, 5], [3.4, 5], [0, 10]]
const chrys = Array.from({ length: 12 }, (_, i) => i * 30)
const maple = 'M0,-11 L2.5,-3.5 L10,-5 L4.5,1 L9,8 L1.5,4.5 L0,12 L-1.5,4.5 L-9,8 L-4.5,1 L-10,-5 L-2.5,-3.5 Z'
</script>

<style scoped>
.hwatu {
  display: block;
  border-radius: 9px;
  box-shadow: 0 4px 14px rgba(20, 16, 12, 0.28);
}
</style>
