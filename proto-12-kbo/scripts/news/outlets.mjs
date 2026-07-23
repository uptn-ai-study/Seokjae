/**
 * 대한민국 주요 언론사 allowlist (뉴스 심리 분석 대상 한정).
 *
 * 구글 뉴스 RSS 의 <source> 이름과 대조해, 아래 목록에 포함된 언론사 기사만 사용한다.
 * 블로그(Naver Blog, tistory, brunch), 아그리게이터(v.daum.net 등), 위키/커뮤니티,
 * 개인 채널은 제외한다. 목록은 docs/NEWS_SOURCES.md 와 화면 "참고 언론사"에 노출된다.
 *
 * 분류는 참고용이며, 매칭은 canonical 이름의 부분 문자열 포함으로 판정한다.
 */
export const OUTLETS = [
  // 통신사
  { name: '연합뉴스', category: '통신사' },
  { name: '연합뉴스TV', category: '통신사' },
  { name: '뉴시스', category: '통신사' },
  { name: '뉴스1', category: '통신사', aliases: ['뉴스1코리아'] },

  // 방송
  { name: 'KBS', category: '방송' },
  { name: 'MBC', category: '방송' },
  { name: 'SBS', category: '방송', aliases: ['SBS Biz', 'SBS연예뉴스'] },
  { name: 'YTN', category: '방송' },
  { name: 'JTBC', category: '방송' },
  { name: 'MBN', category: '방송' },
  { name: 'TV조선', category: '방송' },
  { name: '채널A', category: '방송' },
  { name: 'SPOTV News', category: '방송', aliases: ['SPOTV', '스포티비뉴스'] },

  // 종합일간
  { name: '조선일보', category: '종합일간' },
  { name: '중앙일보', category: '종합일간' },
  { name: '동아일보', category: '종합일간' },
  { name: '한겨레', category: '종합일간' },
  { name: '경향신문', category: '종합일간' },
  { name: '한국일보', category: '종합일간' },
  { name: '국민일보', category: '종합일간' },
  { name: '세계일보', category: '종합일간' },
  { name: '서울신문', category: '종합일간' },
  { name: '문화일보', category: '종합일간' },
  { name: '한국경제', category: '경제', aliases: ['한경닷컴'] },
  { name: '매일경제', category: '경제', aliases: ['MK스포츠', 'MK', '매경'] },
  { name: '서울경제', category: '경제' },
  { name: '머니투데이', category: '경제' },
  { name: '이데일리', category: '경제' },
  { name: '아시아경제', category: '경제' },
  { name: '파이낸셜뉴스', category: '경제' },
  { name: '헤럴드경제', category: '경제' },
  { name: '뉴스핌', category: '경제' },

  // 스포츠 전문
  { name: '스포츠조선', category: '스포츠' },
  { name: '스포츠동아', category: '스포츠' },
  { name: '스포츠서울', category: '스포츠' },
  { name: '스포츠경향', category: '스포츠' },
  { name: '일간스포츠', category: '스포츠' },
  { name: 'OSEN', category: '스포츠' },
  { name: '마이데일리', category: '스포츠' },
  { name: '엑스포츠뉴스', category: '스포츠', aliases: ['Xports News', 'XportsNews'] },
  { name: '스타뉴스', category: '스포츠' },
  { name: '스포탈코리아', category: '스포츠' },
  { name: '스포츠Q', category: '스포츠' },
  { name: '점프볼', category: '스포츠' },

  // 지역 주요일간
  { name: '매일신문', category: '지역', aliases: ['대구'] },
  { name: '부산일보', category: '지역' },
  { name: '국제신문', category: '지역' },
  { name: '광주일보', category: '지역' },
];

// 명시적으로 배제(부분 매칭 오탐 방지): 블로그·아그리게이터·커뮤니티
const DENY = ['blog', 'tistory', 'brunch', 'daum', 'naver', 'youtube', 'namu', 'cafe', '나무위키', '포스트'];

const CANON = OUTLETS.map((o) => ({
  ...o,
  needles: [o.name, ...(o.aliases ?? [])].map((s) => s.toLowerCase()),
}));

/** <source> 문자열 → 표준 언론사명(allowlist에 없으면 null) */
export function matchOutlet(sourceRaw) {
  if (!sourceRaw) return null;
  const s = sourceRaw.toLowerCase().trim();
  if (DENY.some((d) => s.includes(d))) return null;
  for (const o of CANON) {
    if (o.needles.some((n) => s.includes(n))) return o.name;
  }
  return null;
}

/** 화면/문서용: 카테고리별 언론사 목록 */
export function outletsByCategory() {
  const map = new Map();
  for (const o of OUTLETS) {
    if (!map.has(o.category)) map.set(o.category, []);
    map.get(o.category).push(o.name);
  }
  return [...map.entries()].map(([category, names]) => ({ category, names }));
}
