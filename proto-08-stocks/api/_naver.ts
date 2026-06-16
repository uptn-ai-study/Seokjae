// 네이버 금융 실시간 시세 프록시 공유 로직.
// Vercel serverless 함수(api/quotes.ts)와 vite dev 미들웨어가 함께 사용한다.
// 브라우저에서 네이버 금융을 직접 호출하면 CORS로 차단되므로 서버를 경유한다.

export interface Quote {
  code: string        // 종목코드 6자리
  name: string        // 종목명
  price: number       // 현재가(장중) 또는 종가
  change: number      // 전일 대비 (부호 포함)
  changeRate: number  // 등락률 % (부호 포함)
  marketStatus: string // OPEN | CLOSE | ...
  tradedAt: string    // 체결 시각 ISO
}

// 콤마 포함 문자열 숫자 → number
function num(s: unknown): number {
  if (typeof s !== 'string') return Number(s) || 0
  return Number(s.replace(/,/g, '')) || 0
}

// 네이버 등락 코드: 1 상한, 2 상승 → +  /  4 하한, 5 하락 → -  /  3 보합 → 0
function sign(code: string | undefined): number {
  if (code === '4' || code === '5') return -1
  if (code === '1' || code === '2') return 1
  return 0
}

const NAVER_ENDPOINT = 'https://polling.finance.naver.com/api/realtime/domestic/stock/'

/**
 * 종목코드 배열 → 정규화된 시세 배열.
 * 네이버는 콤마로 묶은 다건 조회를 지원하지만, 과도한 길이를 피하려 40개씩 끊어 호출한다.
 */
export async function fetchQuotes(codes: string[]): Promise<Quote[]> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += 40) chunks.push(unique.slice(i, i + 40))

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url = NAVER_ENDPOINT + chunk.join(',')
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://finance.naver.com/',
          Accept: 'application/json',
        },
      })
      if (!res.ok) throw new Error(`naver ${res.status}`)
      const json: any = await res.json()
      const datas: any[] = json?.datas ?? []
      return datas.map((d): Quote => {
        const dir = sign(d?.compareToPreviousPrice?.code)
        return {
          code: String(d.itemCode),
          name: String(d.stockName ?? ''),
          price: num(d.closePrice),
          change: dir * num(d.compareToPreviousClosePrice),
          changeRate: dir * num(d.fluctuationsRatio),
          marketStatus: String(d.marketStatus ?? ''),
          tradedAt: String(d.localTradedAt ?? ''),
        }
      })
    }),
  )

  return results.flat()
}
