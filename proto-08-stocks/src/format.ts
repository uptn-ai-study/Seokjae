// 숫자/통화 포맷 유틸

// 1,234,567 형태 (원 단위)
export function won(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

// 큰 금액을 "12억 3,456만" 형태로 (자산 요약용)
export function eok(n: number): string {
  const abs = Math.abs(Math.round(n))
  const sign = n < 0 ? '-' : ''
  const EOK = 100_000_000
  const MAN = 10_000
  if (abs < MAN) return `${sign}${abs.toLocaleString('ko-KR')}원`
  const eokPart = Math.floor(abs / EOK)
  const manPart = Math.floor((abs % EOK) / MAN)
  const parts: string[] = []
  if (eokPart > 0) parts.push(`${eokPart.toLocaleString('ko-KR')}억`)
  if (manPart > 0) parts.push(`${manPart.toLocaleString('ko-KR')}만`)
  return sign + (parts.join(' ') || '0') + '원'
}

// +1.23% / -0.45% (부호 항상 표기)
export function pct(n: number): string {
  const s = n > 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

// +1,750 / -320 (부호 항상 표기)
export function signedWon(n: number): string {
  const s = n > 0 ? '+' : ''
  return `${s}${won(n)}`
}
