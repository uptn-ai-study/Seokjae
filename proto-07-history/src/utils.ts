// 연도 포맷 헬퍼 (BC=음수, AD=양수)
export function formatYear(y: number): string {
  if (y < 0) return `BC ${(-y).toLocaleString()}`
  if (y === 0) return 'BC/AD'
  return `AD ${y.toLocaleString()}`
}

// 짧은 표기 (눈금자용): BC 3000 → "3000 BC", AD 1500 → "1500"
export function formatYearShort(y: number): string {
  if (y < 0) return `${(-y).toLocaleString()} BC`
  if (y === 0) return '0'
  return y.toLocaleString()
}

// 사건 기간 표기 (단일/범위)
export function formatSpan(start: number, end?: number): string {
  if (end != null && end !== start) return `${formatYear(start)} – ${formatYear(end)}`
  return formatYear(start)
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// 구글지도 검색 URL (장소명 기반)
export function mapsUrl(place: string): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place)
}
