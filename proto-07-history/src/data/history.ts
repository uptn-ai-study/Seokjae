// 세계사 큐레이션 데이터셋
// 연도 표기: BC = 음수, AD = 양수 (예: 2333 BC = -2333, AD 1392 = 1392)
// importance: 1 = 시대를 규정하는 핵심 사건(항상 노출), 2 = 주요 사건, 3 = 상세 사건
// place: 구글지도에서 검색 가능한 관련 장소(유적지·도시). 전승/광역 사건은 생략될 수 있음.
// 신화·전승 기반 연대(고조선 건국, 로마 건국 등)는 desc에 별도 표기.
// 큐레이션 개요 수준이며, 각국 표준 역사 서술의 큰 줄거리와 대표 사건을 담았습니다.

import { REGIONS_EAST } from './regions-east'
import { REGIONS_WEST } from './regions-west'

export type Importance = 1 | 2 | 3

export interface HEvent {
  year: number
  endYear?: number
  title: string
  importance: Importance
  desc: string
  place?: string
}

export interface Period {
  name: string
  start: number
  end: number
  summary?: string
}

export interface Region {
  id: string
  name: string
  emoji: string
  accent: string
  periods: Period[]
  events: HEvent[]
}

// 시간축 범위
export const YEAR_MIN = -5000
export const YEAR_MAX = 2026

// 전 지구적 시대 구분(배경 밴드) — 큰 줄기를 읽기 위한 러프한 구분
export interface GlobalEra {
  name: string
  start: number
  end: number
}
export const GLOBAL_ERAS: GlobalEra[] = [
  { name: '선사 시대', start: -5000, end: -3000 },
  { name: '고대 문명', start: -3000, end: -500 },
  { name: '고전 고대', start: -500, end: 500 },
  { name: '중세', start: 500, end: 1500 },
  { name: '근세', start: 1500, end: 1800 },
  { name: '근대', start: 1800, end: 1945 },
  { name: '현대', start: 1945, end: 2026 },
]

export const REGIONS: Region[] = [...REGIONS_EAST, ...REGIONS_WEST]
