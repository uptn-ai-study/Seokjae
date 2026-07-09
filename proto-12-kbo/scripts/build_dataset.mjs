/**
 * 전체 데이터셋 빌드 엔트리포인트.
 *   node scripts/build_dataset.mjs [--season 2026] [--from 20260301]
 *     [--source kbo_official|csv_archive|dummy] [--boxscore-days 14] [--skip-players]
 *
 * 지난 날짜 원본은 data/raw/ 캐시를 재사용하므로 반복 실행해도
 * 네트워크 요청은 최신 구간에만 발생한다.
 */
import { runPipeline, parseArgs } from './pipeline.mjs';

runPipeline(parseArgs(process.argv.slice(2))).catch((err) => {
  console.error(err);
  process.exit(1);
});
