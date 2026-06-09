import type { Month, Tone } from '../data/months'

export interface Fortune {
  date: string
  a: { month: number }
  b: { month: number }
  title: string
  body: string
  reason: string
  tip: string
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function toneScore(t: Tone): number {
  return t === 'good' ? 1 : t === 'calm' ? 0 : -1
}

function gradeMeta(score: number): { title: string; tip: string } {
  if (score >= 2) return { title: '대길 大吉', tip: '미뤄두었던 그 일, 오늘 시작하기에 더없이 좋습니다.' }
  if (score === 1) return { title: '길 吉', tip: '흐름이 순하니 작은 도전 하나쯤 얹어보세요.' }
  if (score === 0) return { title: '중평 中平', tip: '큰 변화보다 평소의 리듬을 지키는 날입니다.' }
  if (score === -1) return { title: '잔잔 靜', tip: '무리한 약속은 한 박자 미뤄도 괜찮습니다.' }
  return { title: '정중동 靜中動', tip: '채우기보다 비우기. 오늘은 쉼도 어엿한 전략입니다.' }
}

function synthesis(a: Tone, b: Tone): string {
  const key = `${a}-${b}`
  const table: Record<string, string> = {
    'good-good': '두 패가 모두 길하니, 망설임은 잠시 접어두고 한 발 더 내디뎌도 좋은 날입니다.',
    'good-calm': '기세에 차분함이 더해지니, 서두르되 마무리만 놓치지 않으면 탈이 없습니다.',
    'good-caution': '길운 가운데 작은 변수가 섞였으니, 들뜬 마음만 단속하면 무탈히 좋은 하루입니다.',
    'calm-good': '고요함 끝에 좋은 기운이 따라붙으니, 천천히 준비한 사람이 결국 웃게 됩니다.',
    'calm-calm': '두 패가 모두 가라앉아 있으니, 벌이기보다 고르고 다듬는 날로 삼으면 좋습니다.',
    'calm-caution': '차분함이 변동을 만났으니, 욕심을 한 줌 덜고 흐름에 몸을 맡기면 손해가 없습니다.',
    'caution-good': '변수로 출발했으나 끝이 밝으니, 초반의 어수선함만 견디면 반전이 찾아옵니다.',
    'caution-calm': '흔들림 뒤에 고요가 오니, 큰 결정은 잠시 미루고 마음부터 추스르는 게 먼저입니다.',
    'caution-caution': '두 패 모두 변동을 말하니, 새 일을 벌이기보다 지킬 것을 지키는 게 상책입니다.',
  }
  return table[key] ?? table['calm-calm']
}

export function buildFortune(ma: Month, mb: Month, date: string): Fortune {
  const score = toneScore(ma.tone) + toneScore(mb.tone)
  const g = gradeMeta(score)
  const same = ma.id === mb.id

  const body = same
    ? `${pick(ma.luck)} 같은 기운이 두 번이나 겹쳐 드니, 오늘만큼은 그 결을 마음껏 따라가도 좋겠습니다.`
    : `${pick(ma.luck)} ${pick(mb.luck)}`

  const reason = same
    ? `두 손에 똑같은 ‘${ma.name}’ 패가 들어왔습니다. ${ma.meaning} 같은 상징이 나란히 겹친 만큼, 그 빛깔이 평소의 곱절로 짙어지는 하루입니다.`
    : `첫 패는 ‘${ma.name}’, ${ma.meaning} 둘째 패는 ‘${mb.name}’, ${mb.meaning} ${synthesis(ma.tone, mb.tone)}`

  return {
    date,
    a: { month: ma.id },
    b: { month: mb.id },
    title: g.title,
    body,
    reason,
    tip: g.tip,
  }
}
