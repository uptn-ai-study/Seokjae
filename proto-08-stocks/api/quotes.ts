// Vercel Serverless Function: /api/quotes?codes=005930,000660,...
// 프로덕션에서 네이버 금융 시세를 프록시한다.
//
// 의도적으로 "외부 import 없는 완전 자립형"으로 작성한다.
// (api/ 밖 모듈 import 시 Vercel 번들링/해석 문제로 FUNCTION_INVOCATION_FAILED가
//  날 수 있어, 함수는 자체 완결로 두고 동일 로직을 shared/naver.ts가 dev용으로 가진다.)

interface Quote {
  code: string
  name: string
  price: number
  change: number
  changeRate: number
  marketStatus: string
  tradedAt: string
}

function num(s: unknown): number {
  if (typeof s !== 'string') return Number(s) || 0
  return Number(s.replace(/,/g, '')) || 0
}

function sign(code: string | undefined): number {
  if (code === '4' || code === '5') return -1
  if (code === '1' || code === '2') return 1
  return 0
}

async function fetchQuotes(codes: string[]): Promise<Quote[]> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += 40) chunks.push(unique.slice(i, i + 40))

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url =
        'https://polling.finance.naver.com/api/realtime/domestic/stock/' + chunk.join(',')
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

export default async function handler(req: any, res: any) {
  try {
    let codesParam = ''
    const q = req?.query?.codes
    if (Array.isArray(q)) codesParam = q.join(',')
    else if (typeof q === 'string') codesParam = q
    if (!codesParam && req?.url) {
      codesParam = new URL(req.url, 'http://localhost').searchParams.get('codes') ?? ''
    }
    const codes = codesParam.split(',').map((c) => c.trim()).filter(Boolean)

    res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=5')

    if (codes.length === 0) {
      res.status(400).json({ error: 'codes 파라미터가 필요합니다.' })
      return
    }

    const quotes = await fetchQuotes(codes)
    res.status(200).json({ quotes, fetchedAt: new Date().toISOString() })
  } catch (e: any) {
    // 어떤 실패든 JSON으로 표면화 (FUNCTION_INVOCATION_FAILED 방지)
    try {
      res.status(502).json({ error: '시세 조회 실패', detail: String(e?.message ?? e) })
    } catch {
      /* res 사용 불가 시 무시 */
    }
  }
}
