/**
 * 기사 텍스트에서 KBO 팀 언급을 감지하는 공용 모듈.
 * build_news 와 감성 provider(사전/Qwen)가 함께 쓴다.
 */
import { TEAMS } from '../normalize.mjs';

/** 팀 언급 감지용 별칭 (넉넉히 — 과감지는 안전한 방향) */
export const TEAM_ALIASES = {
  LG: ['LG', '엘지', '트윈스'],
  OB: ['두산', '베어스'],
  SK: ['SSG', '랜더스', '에스에스지'],
  WO: ['키움', '히어로즈'],
  SS: ['삼성', '라이온즈'],
  HT: ['KIA', '기아', '타이거즈'],
  LT: ['롯데', '자이언츠'],
  NC: ['NC', '엔씨', '다이노스'],
  KT: ['KT', '케이티', '위즈'],
  HH: ['한화', '이글스'],
};

/** 텍스트에 등장하는 KBO 팀 id 집합 */
export function detectTeams(text) {
  const lower = (text ?? '').toLowerCase();
  const found = new Set();
  for (const [teamId, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some((a) => lower.includes(a.toLowerCase()))) found.add(teamId);
  }
  return found;
}

/** 모델이 반환한 팀 문자열 → teamId (별칭 매칭). 못 찾으면 null */
export function teamIdFromText(s) {
  if (!s) return null;
  const lower = String(s).toLowerCase();
  for (const [teamId, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some((a) => lower.includes(a.toLowerCase()))) return teamId;
  }
  return null;
}

/** 프롬프트에 넣을 팀 표기(짧은 이름) 목록 */
export function teamShortNames() {
  return Object.fromEntries(Object.keys(TEAMS).map((id) => [id, TEAMS[id].name]));
}
