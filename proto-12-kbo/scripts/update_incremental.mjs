/**
 * 증분 갱신 엔트리포인트: 최근 경기만 다시 요청하고 나머지는 캐시 보존.
 *   node scripts/update_incremental.mjs [--days 3]
 *
 * 동작: 최근 N일 경기 목록/박스스코어만 강제 갱신 + 선수 기록 재수집.
 * 지난 날짜는 data/raw/ 캐시에서 읽으므로 기존 데이터가 보존된다(upsert).
 */
import { runPipeline, parseArgs } from './pipeline.mjs';

const opts = parseArgs(process.argv.slice(2));
let days = 3;
const idx = process.argv.indexOf('--days');
if (idx >= 0) days = Number(process.argv[idx + 1]);

runPipeline({ ...opts, forceDays: days, boxscoreDays: days }).catch((err) => {
  console.error(err);
  process.exit(1);
});
