/** 표시 포맷팅 유틸 */

/** 0.363 → ".363" (야구 관례 표기) */
export function fmtRate(v: number | null | undefined): string {
  if (v == null) return '-';
  return v.toFixed(3).replace(/^0\./, '.');
}

/** 2.23 → "2.23" */
export function fmtEra(v: number | null | undefined): string {
  if (v == null) return '-';
  return v.toFixed(2);
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '-';
  return String(v);
}

/** 90.667 → "90 2/3" (이닝 표기) */
export function fmtInnings(v: number | null | undefined): string {
  if (v == null) return '-';
  const whole = Math.floor(v + 1e-6);
  const frac = Math.round((v - whole) * 3);
  if (frac === 0) return String(whole);
  return whole > 0 ? `${whole} ${frac}/3` : `${frac}/3`;
}

/** "20260708" → "7월 8일 (수)" */
export function fmtDate(ymd: string): string {
  const d = toDate(ymd);
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`;
}

/** "20260708" → "2026.07.08" */
export function fmtDateFull(ymd: string): string {
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

export function toDate(ymd: string): Date {
  return new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
  );
}

export function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** 게임차 0 → "-", 5.0 → "5", 5.5 → "5.5" */
export function fmtGamesBehind(v: number): string {
  if (v === 0) return '-';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
