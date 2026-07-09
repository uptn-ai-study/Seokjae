/**
 * KBO 공식 홈페이지 HTTP 헬퍼.
 *
 * ⚠ 데이터 저작권은 KBO(한국야구위원회)에 있습니다.
 *   본 수집 코드는 비상업적/학습용으로만 사용합니다.
 *   robots.txt 를 준수하고, 요청 간 지연(rate limit)을 둡니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) kbo-viewer/0.1 (non-commercial, educational)';

const MIN_DELAY_MS = 400; // 요청 간 최소 지연
const MAX_RETRY = 3;

let lastRequestAt = 0;

// ASP.NET 세션 쿠키 유지용 간이 쿠키 저장소 (__VIEWSTATE 포스트백에 필요)
const cookieJar = new Map();

function cookieHeader() {
  if (!cookieJar.size) return null;
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(res) {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequestAt + MIN_DELAY_MS - now;
  if (wait > 0) await sleep(wait + Math.floor(Math.random() * 150));
  lastRequestAt = Date.now();
}

/**
 * POST form-urlencoded 요청 (ASMX 내부 엔드포인트용).
 * Referer 헤더가 없으면 KBO 서버가 에러 페이지를 반환하므로 필수.
 */
export async function postForm(url, params, { referer } = {}) {
  const body = new URLSearchParams(params).toString();
  return request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer ?? 'https://www.koreabaseball.com/',
    },
    body,
  });
}

export async function getPage(url, { referer } = {}) {
  return request(url, {
    method: 'GET',
    headers: referer ? { Referer: referer } : {},
  });
}

async function request(url, init) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    await rateLimit();
    try {
      const cookies = cookieHeader();
      const res = await fetch(url, {
        ...init,
        headers: {
          'User-Agent': USER_AGENT,
          ...(cookies ? { Cookie: cookies } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(30_000),
      });
      storeCookies(res);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url} :: ${text.slice(0, 200)}`);
      // KBO 는 오류 시에도 200 + 에러 HTML 을 줄 때가 있어 방어
      if (text.includes('<title>에러 | KBO홈페이지')) {
        throw new Error(`KBO error page returned for ${url}`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRY) {
        const backoff = 1000 * attempt;
        console.warn(`  retry ${attempt}/${MAX_RETRY} after ${backoff}ms: ${err.message}`);
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

/** 원본 응답을 data/raw/ 아래 캐시로 저장 */
export function saveRaw(relPath, content) {
  const file = path.join(rawDir(), relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

export function readRaw(relPath) {
  const file = path.join(rawDir(), relPath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function rawDir() {
  return path.join(projectRoot(), 'data', 'raw');
}

export function projectRoot() {
  return path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
}
