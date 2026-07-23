/**
 * 구글 뉴스 RSS 수집기 (팀별 야구 기사).
 *
 * ⚠ 기사 저작권은 각 언론사에 있다. 본 코드는 비상업적/학습용으로 제목·요약·링크만
 *   인용하며, 원문 전체를 저장하지 않는다. 요청 간 지연을 둔다.
 *
 * 구글 뉴스 검색 RSS: https://news.google.com/rss/search?q=...&hl=ko&gl=KR&ceid=KR:ko
 *  - q 에 `after:YYYY-MM-DD before:YYYY-MM-DD` 로 기간 지정(경계는 다소 느슨 → pubDate로 재필터)
 *  - <item> 별 title / link / pubDate / <source> 제공
 */

const UA = 'Mozilla/5.0 (compatible; kbo-viewer/0.1; non-commercial, educational)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decode(s) {
  return (s ?? '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function parseItems(xml) {
  return xml.split('<item>').slice(1).map((chunk) => {
    const body = chunk.split('</item>')[0];
    const pick = (re) => (body.match(re) || [])[1] || '';
    const rawTitle = decode(pick(/<title>([\s\S]*?)<\/title>/));
    const source = decode(pick(/<source[^>]*>([\s\S]*?)<\/source>/));
    // 제목 끝의 " - 출처" 꼬리 제거
    const title = source && rawTitle.endsWith(` - ${source}`)
      ? rawTitle.slice(0, -(source.length + 3)).trim()
      : rawTitle.replace(/\s-\s[^-]+$/, '').trim();
    return {
      title,
      source,
      link: decode(pick(/<link>([\s\S]*?)<\/link>/)),
      pubDate: pick(/<pubDate>([\s\S]*?)<\/pubDate>/).trim(),
      description: decode(pick(/<description>([\s\S]*?)<\/description>/)).replace(/<[^>]+>/g, ' ').trim(),
    };
  });
}

/**
 * 한 팀의 기사 수집.
 * @param {string} query 예: "LG 트윈스 야구"
 * @param {{from:string, to:string}} window YYYYMMDD (to 포함)
 */
export async function fetchTeamNews(query, { from, to }) {
  const afterD = ymdToDash(from);
  const beforeD = ymdToDash(addDays(to, 1)); // before 는 배타적 → to 다음날
  const q = `${query} after:${afterD} before:${beforeD}`;
  const url =
    'https://news.google.com/rss/search?' +
    new URLSearchParams({ q, hl: 'ko', gl: 'KR', ceid: 'KR:ko' });

  let xml = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      xml = await res.text();
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(800 * attempt);
    }
  }

  const fromMs = ymdToDate(from).getTime();
  const toMs = ymdToDate(to).getTime() + 86400_000 - 1; // to 하루 끝까지
  return parseItems(xml).filter((it) => {
    if (!it.title) return false;
    const t = Date.parse(it.pubDate);
    return Number.isFinite(t) && t >= fromMs && t <= toMs;
  });
}

// --- 날짜 유틸 (YYYYMMDD) ---
export function addDays(ymd, n) {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
function ymdToDate(ymd) {
  return new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00Z`);
}
function ymdToDash(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
