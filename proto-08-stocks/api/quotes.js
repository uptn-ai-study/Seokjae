// Vercel Serverless Function: /api/quotes?codes=005930,000660,...
// 프로덕션에서 네이버 금융 시세를 프록시한다.
//
// ⚠️ 의도적으로 "순수 CommonJS JavaScript"로 작성한다.
//    .ts로 두면 Vercel이 프로젝트 tsconfig(noEmit/allowImportingTsExtensions 등,
//    Vite 번들러 모드용)를 참조해 함수가 깨져 FUNCTION_INVOCATION_FAILED가 났다.
//    .js 함수는 TS 컴파일을 거치지 않아 그 영향이 전혀 없다.
//    (동일 로직의 TS 버전은 shared/naver.ts가 vite dev 미들웨어용으로 보유)

function num(s) {
  if (typeof s !== 'string') return Number(s) || 0
  return Number(s.replace(/,/g, '')) || 0
}

// 네이버 등락 코드: 1 상한, 2 상승 → +  /  4 하한, 5 하락 → -  /  3 보합 → 0
function sign(code) {
  if (code === '4' || code === '5') return -1
  if (code === '1' || code === '2') return 1
  return 0
}

async function fetchQuotes(codes) {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const chunks = []
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
      if (!res.ok) throw new Error('naver ' + res.status)
      const json = await res.json()
      const datas = (json && json.datas) || []
      return datas.map((d) => {
        const dir = sign(d && d.compareToPreviousPrice && d.compareToPreviousPrice.code)
        return {
          code: String(d.itemCode),
          name: String(d.stockName || ''),
          price: num(d.closePrice),
          change: dir * num(d.compareToPreviousClosePrice),
          changeRate: dir * num(d.fluctuationsRatio),
          marketStatus: String(d.marketStatus || ''),
          tradedAt: String(d.localTradedAt || ''),
        }
      })
    }),
  )

  return results.flat()
}

module.exports = async function handler(req, res) {
  try {
    let codesParam = ''
    const q = req && req.query && req.query.codes
    if (Array.isArray(q)) codesParam = q.join(',')
    else if (typeof q === 'string') codesParam = q
    if (!codesParam && req && req.url) {
      codesParam = new URL(req.url, 'http://localhost').searchParams.get('codes') || ''
    }
    const codes = codesParam.split(',').map((c) => c.trim()).filter(Boolean)

    res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=5')

    if (codes.length === 0) {
      res.status(400).json({ error: 'codes 파라미터가 필요합니다.' })
      return
    }

    const quotes = await fetchQuotes(codes)
    res.status(200).json({ quotes, fetchedAt: new Date().toISOString() })
  } catch (e) {
    try {
      res.status(502).json({ error: '시세 조회 실패', detail: String((e && e.message) || e) })
    } catch (_) {
      /* res 사용 불가 시 무시 */
    }
  }
}
