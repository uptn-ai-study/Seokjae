// Vercel Serverless Function: /api/quotes?codes=005930,000660,...
// 프로덕션(Vercel)에서 네이버 금융 시세를 프록시한다.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchQuotes } from '../shared/naver'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // req.query.codes 가 기본이나, 혹시 비어있으면 raw URL에서 직접 파싱(방어적)
  let codesParam = ''
  const q = (req.query?.codes ?? '') as string | string[]
  codesParam = Array.isArray(q) ? q.join(',') : q
  if (!codesParam && req.url) {
    codesParam = new URL(req.url, 'http://localhost').searchParams.get('codes') ?? ''
  }
  const codes = codesParam.split(',').map((c) => c.trim()).filter(Boolean)

  // 클라이언트 캐시는 짧게(시세는 자주 변함)
  res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=5')

  if (codes.length === 0) {
    res.status(400).json({ error: 'codes 파라미터가 필요합니다.' })
    return
  }

  try {
    const quotes = await fetchQuotes(codes)
    res.status(200).json({ quotes, fetchedAt: new Date().toISOString() })
  } catch (e: any) {
    res.status(502).json({ error: '시세 조회 실패', detail: String(e?.message ?? e) })
  }
}
