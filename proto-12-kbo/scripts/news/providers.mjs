/**
 * 감성 분석 provider (교체식).
 *
 *  - lexicon : 사전(키워드) 기반. 무료·무키. 단일 팀 기사만 집계(여러 팀은 중립).
 *  - nvidia  : NVIDIA NIM 의 Qwen 3.5 로 기사별 "팀 맥락" 감성 판정.
 *              한 기사에서 팀마다 호재/악재를 따로 판단 → 여러 팀 기사도 집계 가능.
 *              NVIDIA_API_KEY 가 있으면 자동 선택, 없으면 lexicon.
 *
 * provider.classify(articles) 는 각 article 에 `perTeam` 을 채운다:
 *   article.perTeam = { teamId: { label:'pos'|'neg'|'neu', score:number(-2..2), reason, terms? } }
 * 반환값은 method 문자열.
 */
import { projectRoot } from '../lib/http.mjs';
import { scoreText } from './sentiment.mjs';
import { teamIdFromText, teamShortNames } from './teams_detect.mjs';
import { TEAMS } from '../normalize.mjs';

let envLoaded = false;
/** proto-12-kbo/.env 를 1회 로드(있으면). 키가 이미 있으면 건너뜀. */
function ensureEnvLoaded() {
  if (envLoaded) return;
  envLoaded = true;
  if (process.env.NVIDIA_API_KEY) return;
  try {
    // Node 20.12+/24: process.loadEnvFile — 파일 없으면 throw → 무시
    process.loadEnvFile(`${projectRoot()}/.env`);
  } catch {
    /* .env 없음 — 무시 */
  }
}

export function getSentimentProvider() {
  ensureEnvLoaded();
  const key = process.env.NVIDIA_API_KEY;
  if (key) return nvidiaProvider(key);
  return lexiconProvider();
}

// ------------------------------------------------------------- 사전 provider

export function lexiconProvider() {
  return {
    name: 'lexicon',
    method: 'lexicon-singleteam',
    async classify(articles) {
      for (const a of articles) {
        // 단일 팀 기사만 집계, 여러 팀은 중립(제외)
        if (a.teams.size === 1) {
          const teamId = [...a.teams][0];
          const s = scoreText(a.text);
          a.perTeam = {
            [teamId]: { label: s.label, score: s.score, reason: '', terms: { pos: s.posTerms, neg: s.negTerms } },
          };
        } else {
          a.perTeam = {};
        }
      }
      return this.method;
    },
  };
}

// -------------------------------------------------------- NVIDIA(Qwen) provider

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
// 무료 엔드포인트 실측 검증(2026-07): Gemma 4 31B 가 한국어·팀별 맥락·속도·안정성 최적.
// (Qwen 3.5 는 404 미서빙, Qwen3-Next/Llama-3.3 타임아웃, DeepSeek V4 과부하)
// NVIDIA_MODEL 로 override 가능.
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'google/gemma-4-31b-it';
const BATCH = 8; // 한 요청에 담는 기사 수
const REQ_DELAY_MS = 1500; // 요청 간 지연(40 RPM 한도 여유)
const DESC_MAX = 300;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** model id → 짧은 표시 라벨 */
function modelLabelOf(id) {
  const s = id.split('/').pop();
  if (/gemma-4/.test(s)) return 'Gemma 4';
  if (/gemma-3/.test(s)) return 'Gemma 3';
  if (/qwen3\.5/.test(s)) return 'Qwen 3.5';
  if (/qwen3/.test(s)) return 'Qwen 3';
  if (/deepseek-v4/.test(s)) return 'DeepSeek V4';
  if (/llama-3\.3/.test(s)) return 'Llama 3.3';
  return s;
}

export function nvidiaProvider(apiKey) {
  const shortNames = teamShortNames(); // teamId -> '삼성' 등
  return {
    name: `nvidia:${NVIDIA_MODEL}`,
    method: 'nvidia',
    modelLabel: modelLabelOf(NVIDIA_MODEL),
    async classify(articles) {
      // 팀이 하나도 감지 안 된 기사는 스킵(빈 perTeam)
      const targets = articles.filter((a) => a.teams.size > 0);
      for (const a of articles) a.perTeam = a.perTeam ?? {};

      for (let i = 0; i < targets.length; i += BATCH) {
        const batch = targets.slice(i, i + BATCH);
        const results = await classifyBatch(apiKey, batch, shortNames);
        for (const r of results) {
          const a = batch[r.i];
          if (!a) continue;
          for (const t of r.teams ?? []) {
            const teamId = teamIdFromText(t.team);
            if (!teamId || !a.teams.has(teamId)) continue; // 언급 안 된 팀 무시
            const label = t.s === 'pos' ? 'pos' : t.s === 'neg' ? 'neg' : 'neu';
            const score = clampScore(t.score, label);
            a.perTeam[teamId] = { label, score, reason: String(t.reason ?? '').slice(0, 80) };
          }
        }
        if (i + BATCH < targets.length) await sleep(REQ_DELAY_MS);
      }
      return this.method;
    },
  };
}

function clampScore(v, label) {
  let n = Number(v);
  if (!Number.isFinite(n)) n = label === 'pos' ? 1 : label === 'neg' ? -1 : 0;
  n = Math.max(-2, Math.min(2, Math.round(n)));
  // 라벨과 부호 정합
  if (label === 'pos' && n <= 0) n = 1;
  if (label === 'neg' && n >= 0) n = -1;
  if (label === 'neu') n = 0;
  return n;
}

const SYSTEM_PROMPT =
  '당신은 KBO(한국 프로야구) 뉴스 감성 분석기입니다. 각 기사에 대해, 기사에 언급된 각 구단 관점에서 ' +
  '그 구단에게 호재(pos)/악재(neg)/중립(neu)인지 판단하세요. 승리·활약·복귀·영입은 그 팀에 호재, ' +
  '패배·부상·이탈·부진·방출은 악재입니다. 한 경기 기사라도 이긴 팀은 호재, 진 팀은 악재로 팀별로 다르게 판정합니다. ' +
  'score 는 -2(매우 악재)~2(매우 호재) 정수, reason 은 한국어 한 줄. ' +
  '반드시 아래 JSON 형식만 출력하고 다른 텍스트는 쓰지 마세요: ' +
  '{"results":[{"i":0,"teams":[{"team":"KIA","s":"pos","score":2,"reason":"..."}]}]}';

async function classifyBatch(apiKey, batch, shortNames) {
  const lines = batch.map((a, idx) => {
    const teams = [...a.teams].map((id) => shortNames[id] ?? TEAMS[id]?.name ?? id).join(', ');
    const desc = (a.description ?? '').slice(0, DESC_MAX);
    return `${idx}. [언급팀: ${teams}] ${a.title}${desc ? ' / ' + desc : ''}`;
  });
  const userPrompt =
    `아래 ${batch.length}건 기사를 분석해 JSON 으로만 답하세요. 각 기사의 "언급팀"에 대해서만 판정합니다.\n` +
    lines.join('\n');

  const body = {
    model: NVIDIA_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    top_p: 0.7,
    max_tokens: Math.min(4096, 200 + batch.length * 120),
    stream: false,
  };

  const content = await callNvidia(apiKey, body);
  return parseResults(content);
}

async function callNvidia(apiKey, body) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`NVIDIA 인증 실패(${res.status}) — API 키 확인 필요`);
      }
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`NVIDIA 일시 오류 ${res.status}`);
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`NVIDIA HTTP ${res.status}: ${t.slice(0, 150)}`);
      }
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      lastErr = err;
      if (/인증 실패/.test(err.message)) throw err; // 키 문제는 재시도 무의미
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

/** Qwen 응답 문자열에서 JSON 추출·파싱 (<think> 블록·코드펜스 방어) */
function parseResults(content) {
  if (!content) return [];
  let text = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  text = text.replace(/```json|```/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) return [];
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(obj.results) ? obj.results : [];
  } catch {
    return [];
  }
}
