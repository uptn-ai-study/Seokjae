/**
 * 과거 시즌 CSV 아카이브 어댑터 (T-06, 과거 데이터 보강용).
 *
 * data/archive/games-<season>.csv 형식의 파일을 소스 레코드로 변환한다.
 * 컬럼: date,awayTeamId,homeTeamId,awayScore,homeScore,stadium
 * (choosunsick/KBO_data 등 공개 CSV 를 이 형식으로 내려받아 사용)
 */
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../lib/http.mjs';
import { registerSource } from './base.mjs';
import { TEAMS } from '../normalize.mjs';

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(',').map((c) => c.trim());
  return lines
    .filter((l) => l.trim())
    .map((l) => {
      const vals = l.split(',');
      return Object.fromEntries(cols.map((c, i) => [c, (vals[i] ?? '').trim()]));
    });
}

export const csvArchive = {
  name: 'csv_archive',
  async fetchGames({ season }) {
    const file = path.join(projectRoot(), 'data', 'archive', `games-${season}.csv`);
    if (!fs.existsSync(file)) {
      console.warn(`csv_archive: ${file} 없음 - 빈 목록 반환`);
      return [];
    }
    return parseCsv(fs.readFileSync(file, 'utf8')).map((r, i) => ({
      gameId: `${r.date}${r.awayTeamId}${r.homeTeamId}${i % 10}`,
      date: r.date,
      time: '',
      season,
      seriesId: 0,
      seriesName: '정규경기',
      stadium: r.stadium ?? '',
      status: 'finished',
      cancelReason: '',
      awayTeamId: r.awayTeamId,
      homeTeamId: r.homeTeamId,
      awayTeamName: TEAMS[r.awayTeamId]?.name ?? r.awayTeamId,
      homeTeamName: TEAMS[r.homeTeamId]?.name ?? r.homeTeamId,
      awayScore: Number(r.awayScore),
      homeScore: Number(r.homeScore),
      winPitcher: null,
      losePitcher: null,
      savePitcher: null,
      broadcast: '',
    }));
  },
  async fetchPlayers() {
    return { hitters: [], pitchers: [] };
  },
};

registerSource(csvArchive);
