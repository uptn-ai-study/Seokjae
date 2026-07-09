/**
 * 지표 용어 사전 — 초심자용 쉬운 설명의 단일 원천.
 * direction: 'higher' = 높을수록 좋음, 'lower' = 낮을수록 좋음, 'neutral'
 */
export interface GlossaryEntry {
  key: string;
  label: string; // 표 헤더에 쓰는 축약 표기
  korean: string;
  description: string;
  direction: 'higher' | 'lower' | 'neutral';
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  avg: {
    key: 'avg', label: 'AVG', korean: '타율',
    description: '타수 대비 안타 비율. 3할(.300)이면 뛰어난 타자로 봅니다.',
    direction: 'higher',
  },
  obp: {
    key: 'obp', label: 'OBP', korean: '출루율',
    description: '볼넷·사구까지 포함해 얼마나 자주 베이스에 나가는지. .400 이상이면 최상급.',
    direction: 'higher',
  },
  slg: {
    key: 'slg', label: 'SLG', korean: '장타율',
    description: '안타의 "질"을 반영한 지표. 홈런·2루타가 많을수록 높아집니다.',
    direction: 'higher',
  },
  ops: {
    key: 'ops', label: 'OPS', korean: 'OPS',
    description: '출루율+장타율. 타자의 종합 공격력을 한 숫자로 보여줍니다. 0.9 이상이면 리그 정상급.',
    direction: 'higher',
  },
  pa: {
    key: 'pa', label: 'PA', korean: '타석',
    description: '타자가 타석에 들어선 횟수(볼넷 등 포함).',
    direction: 'neutral',
  },
  ab: {
    key: 'ab', label: 'AB', korean: '타수',
    description: '타석에서 볼넷·희생타 등을 뺀, 타율 계산의 분모.',
    direction: 'neutral',
  },
  r: {
    key: 'r', label: 'R', korean: '득점',
    description: '홈을 밟아 점수를 낸 횟수.',
    direction: 'higher',
  },
  h: {
    key: 'h', label: 'H', korean: '안타',
    description: '안타 개수(1루타~홈런 모두 포함).',
    direction: 'higher',
  },
  hr: {
    key: 'hr', label: 'HR', korean: '홈런',
    description: '담장을 넘긴 타구. 한 번에 점수를 내는 가장 확실한 방법.',
    direction: 'higher',
  },
  rbi: {
    key: 'rbi', label: 'RBI', korean: '타점',
    description: '내 타격으로 주자(또는 나)가 득점한 횟수.',
    direction: 'higher',
  },
  bb: {
    key: 'bb', label: 'BB', korean: '볼넷',
    description: '4개의 볼을 골라 1루로 걸어 나간 횟수. 선구안의 지표.',
    direction: 'higher',
  },
  so: {
    key: 'so', label: 'SO', korean: '삼진',
    description: '타자라면 적을수록, 투수라면 많을수록 좋습니다.',
    direction: 'neutral',
  },
  sb: {
    key: 'sb', label: 'SB', korean: '도루',
    description: '투구 사이에 다음 베이스를 훔친 횟수. 주력의 지표.',
    direction: 'higher',
  },
  era: {
    key: 'era', label: 'ERA', korean: '평균자책점',
    description: '9이닝당 투수가 내준 자책점. 3점대 이하면 좋은 선발투수입니다.',
    direction: 'lower',
  },
  whip: {
    key: 'whip', label: 'WHIP', korean: 'WHIP',
    description: '이닝당 내보낸 주자 수(볼넷+피안타). 1.2 이하면 우수합니다.',
    direction: 'lower',
  },
  w: {
    key: 'w', label: 'W', korean: '승',
    description: '승리투수가 된 횟수.',
    direction: 'higher',
  },
  l: {
    key: 'l', label: 'L', korean: '패',
    description: '패전투수가 된 횟수.',
    direction: 'lower',
  },
  sv: {
    key: 'sv', label: 'SV', korean: '세이브',
    description: '리드를 지키며 경기를 끝낸 마무리 투수의 기록.',
    direction: 'higher',
  },
  hld: {
    key: 'hld', label: 'HLD', korean: '홀드',
    description: '중간계투가 리드를 지킨 채 다음 투수에게 넘긴 기록.',
    direction: 'higher',
  },
  ip: {
    key: 'ip', label: 'IP', korean: '이닝',
    description: '던진 이닝 수. "1/3"은 아웃 1개를 뜻합니다.',
    direction: 'higher',
  },
  qs: {
    key: 'qs', label: 'QS', korean: '퀄리티스타트',
    description: '선발이 6이닝 이상, 자책 3점 이하로 던진 경기 수.',
    direction: 'higher',
  },
  oavg: {
    key: 'oavg', label: 'OAVG', korean: '피안타율',
    description: '상대 타자들의 타율. 낮을수록 치기 어려운 투수.',
    direction: 'lower',
  },
  winPct: {
    key: 'winPct', label: '승률', korean: '승률',
    description: '승 ÷ (승+패). 무승부는 계산에서 빠집니다(KBO 방식).',
    direction: 'higher',
  },
  gamesBehind: {
    key: 'gamesBehind', label: '게임차', korean: '게임차',
    description: '1위와의 격차. "5"면 1위가 5연패하고 이 팀이 5연승해야 동률이 된다는 뜻.',
    direction: 'lower',
  },
  last10: {
    key: 'last10', label: '최근10', korean: '최근 10경기',
    description: '최근 10경기의 승-패-무. 팀의 상승세/하락세를 보여줍니다.',
    direction: 'neutral',
  },
  streak: {
    key: 'streak', label: '연속', korean: '연속',
    description: '현재 이어지고 있는 연승/연패.',
    direction: 'neutral',
  },
  risp: {
    key: 'risp', label: '득타율', korean: '득점권 타율',
    description: '주자가 2루 이상에 있을 때의 타율. 찬스에 강한지 보여줍니다.',
    direction: 'higher',
  },
};

export function glossaryOf(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}
