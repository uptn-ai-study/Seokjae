// 프론트엔드 → /api/quotes 시세 조회 클라이언트

export interface Quote {
  code: string
  name: string
  price: number
  change: number
  changeRate: number
  marketStatus: string
  tradedAt: string
}

export interface QuotesResponse {
  quotes: Quote[]
  fetchedAt: string
}

export async function getQuotes(codes: string[]): Promise<Quote[]> {
  if (codes.length === 0) return []
  const res = await fetch(`/api/quotes?codes=${encodeURIComponent(codes.join(','))}`)
  if (!res.ok) throw new Error(`quotes ${res.status}`)
  const data: QuotesResponse = await res.json()
  return data.quotes ?? []
}
