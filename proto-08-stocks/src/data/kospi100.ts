// KOSPI 대형주 100선 (KOSPI 100 구성 종목 기준의 대표 라인업).
// 종목코드는 네이버 금융 실시간 시세 조회에 그대로 사용된다.
// 혹시 코드가 변경/상폐된 종목은 시세 응답에서 누락되어 자동으로 빠지도록 처리한다.

export interface StockMeta {
  code: string
  name: string
  sector: string
}

export const SECTORS = [
  '전체',
  '반도체·IT',
  '자동차',
  '2차전지·화학',
  '바이오·제약',
  '금융',
  '인터넷·게임',
  '소비재·유통',
  '중공업·방산',
  '에너지·소재',
  '건설·기타',
] as const

export type Sector = (typeof SECTORS)[number]

export const KOSPI100: StockMeta[] = [
  // 반도체·IT
  { code: '005930', name: '삼성전자', sector: '반도체·IT' },
  { code: '000660', name: 'SK하이닉스', sector: '반도체·IT' },
  { code: '009150', name: '삼성전기', sector: '반도체·IT' },
  { code: '066570', name: 'LG전자', sector: '반도체·IT' },
  { code: '018260', name: '삼성에스디에스', sector: '반도체·IT' },
  { code: '042700', name: '한미반도체', sector: '반도체·IT' },
  { code: '000990', name: 'DB하이텍', sector: '반도체·IT' },
  { code: '058470', name: '리노공업', sector: '반도체·IT' },
  { code: '240810', name: '원익IPS', sector: '반도체·IT' },
  { code: '357780', name: '솔브레인', sector: '반도체·IT' },

  // 자동차
  { code: '005380', name: '현대차', sector: '자동차' },
  { code: '000270', name: '기아', sector: '자동차' },
  { code: '012330', name: '현대모비스', sector: '자동차' },
  { code: '086280', name: '현대글로비스', sector: '자동차' },
  { code: '011210', name: '현대위아', sector: '자동차' },
  { code: '204320', name: 'HL만도', sector: '자동차' },
  { code: '018880', name: '한온시스템', sector: '자동차' },
  { code: '161390', name: '한국타이어앤테크놀로지', sector: '자동차' },

  // 2차전지·화학
  { code: '373220', name: 'LG에너지솔루션', sector: '2차전지·화학' },
  { code: '006400', name: '삼성SDI', sector: '2차전지·화학' },
  { code: '051910', name: 'LG화학', sector: '2차전지·화학' },
  { code: '003670', name: '포스코퓨처엠', sector: '2차전지·화학' },
  { code: '247540', name: '에코프로비엠', sector: '2차전지·화학' },
  { code: '011170', name: '롯데케미칼', sector: '2차전지·화학' },
  { code: '009830', name: '한화솔루션', sector: '2차전지·화학' },
  { code: '011790', name: 'SKC', sector: '2차전지·화학' },
  { code: '285130', name: 'SK케미칼', sector: '2차전지·화학' },
  { code: '298050', name: '효성첨단소재', sector: '2차전지·화학' },

  // 바이오·제약
  { code: '207940', name: '삼성바이오로직스', sector: '바이오·제약' },
  { code: '068270', name: '셀트리온', sector: '바이오·제약' },
  { code: '302440', name: 'SK바이오사이언스', sector: '바이오·제약' },
  { code: '326030', name: 'SK바이오팜', sector: '바이오·제약' },
  { code: '000100', name: '유한양행', sector: '바이오·제약' },
  { code: '128940', name: '한미약품', sector: '바이오·제약' },
  { code: '185750', name: '종근당', sector: '바이오·제약' },
  { code: '006280', name: '녹십자', sector: '바이오·제약' },
  { code: '069620', name: '대웅제약', sector: '바이오·제약' },
  { code: '091990', name: '셀트리온헬스케어', sector: '바이오·제약' },

  // 금융
  { code: '105560', name: 'KB금융', sector: '금융' },
  { code: '055550', name: '신한지주', sector: '금융' },
  { code: '086790', name: '하나금융지주', sector: '금융' },
  { code: '316140', name: '우리금융지주', sector: '금융' },
  { code: '138040', name: '메리츠금융지주', sector: '금융' },
  { code: '024110', name: '기업은행', sector: '금융' },
  { code: '032830', name: '삼성생명', sector: '금융' },
  { code: '000810', name: '삼성화재', sector: '금융' },
  { code: '029780', name: '삼성카드', sector: '금융' },
  { code: '071050', name: '한국금융지주', sector: '금융' },
  { code: '006800', name: '미래에셋증권', sector: '금융' },
  { code: '016360', name: '삼성증권', sector: '금융' },
  { code: '039490', name: '키움증권', sector: '금융' },
  { code: '005940', name: 'NH투자증권', sector: '금융' },
  { code: '323410', name: '카카오뱅크', sector: '금융' },

  // 인터넷·게임
  { code: '035420', name: 'NAVER', sector: '인터넷·게임' },
  { code: '035720', name: '카카오', sector: '인터넷·게임' },
  { code: '377300', name: '카카오페이', sector: '인터넷·게임' },
  { code: '259960', name: '크래프톤', sector: '인터넷·게임' },
  { code: '036570', name: '엔씨소프트', sector: '인터넷·게임' },
  { code: '251270', name: '넷마블', sector: '인터넷·게임' },

  // 소비재·유통
  { code: '090430', name: '아모레퍼시픽', sector: '소비재·유통' },
  { code: '051900', name: 'LG생활건강', sector: '소비재·유통' },
  { code: '033780', name: 'KT&G', sector: '소비재·유통' },
  { code: '097950', name: 'CJ제일제당', sector: '소비재·유통' },
  { code: '271560', name: '오리온', sector: '소비재·유통' },
  { code: '280360', name: '롯데웰푸드', sector: '소비재·유통' },
  { code: '004990', name: '롯데지주', sector: '소비재·유통' },
  { code: '023530', name: '롯데쇼핑', sector: '소비재·유통' },
  { code: '139480', name: '이마트', sector: '소비재·유통' },
  { code: '004170', name: '신세계', sector: '소비재·유통' },
  { code: '282330', name: 'BGF리테일', sector: '소비재·유통' },
  { code: '069960', name: '현대백화점', sector: '소비재·유통' },
  { code: '008770', name: '호텔신라', sector: '소비재·유통' },
  { code: '000080', name: '하이트진로', sector: '소비재·유통' },

  // 중공업·방산
  { code: '012450', name: '한화에어로스페이스', sector: '중공업·방산' },
  { code: '272210', name: '한화시스템', sector: '중공업·방산' },
  { code: '079550', name: 'LIG넥스원', sector: '중공업·방산' },
  { code: '047810', name: '한국항공우주', sector: '중공업·방산' },
  { code: '064350', name: '현대로템', sector: '중공업·방산' },
  { code: '329180', name: 'HD현대중공업', sector: '중공업·방산' },
  { code: '042660', name: '한화오션', sector: '중공업·방산' },
  { code: '009540', name: 'HD한국조선해양', sector: '중공업·방산' },
  { code: '010140', name: '삼성중공업', sector: '중공업·방산' },
  { code: '267260', name: 'HD현대일렉트릭', sector: '중공업·방산' },
  { code: '241560', name: '두산밥캣', sector: '중공업·방산' },
  { code: '034020', name: '두산에너빌리티', sector: '중공업·방산' },

  // 에너지·소재
  { code: '005490', name: 'POSCO홀딩스', sector: '에너지·소재' },
  { code: '010130', name: '고려아연', sector: '에너지·소재' },
  { code: '096770', name: 'SK이노베이션', sector: '에너지·소재' },
  { code: '010950', name: 'S-Oil', sector: '에너지·소재' },
  { code: '015760', name: '한국전력', sector: '에너지·소재' },
  { code: '036460', name: '한국가스공사', sector: '에너지·소재' },
  { code: '018670', name: 'SK가스', sector: '에너지·소재' },
  { code: '112610', name: '씨에스윈드', sector: '에너지·소재' },

  // 건설·기타(지주/통신/운송)
  { code: '034730', name: 'SK', sector: '건설·기타' },
  { code: '003550', name: 'LG', sector: '건설·기타' },
  { code: '028260', name: '삼성물산', sector: '건설·기타' },
  { code: '267250', name: 'HD현대', sector: '건설·기타' },
  { code: '017670', name: 'SK텔레콤', sector: '건설·기타' },
  { code: '030200', name: 'KT', sector: '건설·기타' },
  { code: '032640', name: 'LG유플러스', sector: '건설·기타' },
  { code: '000720', name: '현대건설', sector: '건설·기타' },
  { code: '006360', name: 'GS건설', sector: '건설·기타' },
  { code: '375500', name: 'DL이앤씨', sector: '건설·기타' },
  { code: '003490', name: '대한항공', sector: '건설·기타' },
  { code: '000120', name: 'CJ대한통운', sector: '건설·기타' },
  { code: '011200', name: 'HMM', sector: '건설·기타' },
  { code: '021240', name: '코웨이', sector: '건설·기타' },
  { code: '078930', name: 'GS', sector: '건설·기타' },
]

export const CODE_TO_META: Record<string, StockMeta> = Object.fromEntries(
  KOSPI100.map((s) => [s.code, s]),
)

export const ALL_CODES: string[] = KOSPI100.map((s) => s.code)
