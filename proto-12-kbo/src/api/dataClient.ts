/**
 * 정규화 JSON fetch 래퍼. 메모리 캐시로 중복 요청을 막는다.
 * 데이터는 빌드 시 public/data/ 로 동기화된 정적 파일.
 */
import type {
  GamesFile,
  StandingsFile,
  HittersFile,
  PitchersFile,
  Boxscore,
  NewsFile,
} from '../types/kbo';

const BASE = import.meta.env.BASE_URL + 'data';
const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`${BASE}/${path}`).then((res) => {
        if (!res.ok) {
          cache.delete(path);
          throw new Error(`데이터를 불러오지 못했습니다 (${res.status}): ${path}`);
        }
        return res.json();
      }),
    );
  }
  return cache.get(path) as Promise<T>;
}

export const SEASON = 2026;

export const dataClient = {
  games: (season = SEASON) => fetchJson<GamesFile>(`games/${season}.json`),
  standings: (season = SEASON) => fetchJson<StandingsFile>(`standings/${season}.json`),
  hitters: (season = SEASON) => fetchJson<HittersFile>(`hitters/${season}.json`),
  pitchers: (season = SEASON) => fetchJson<PitchersFile>(`pitchers/${season}.json`),
  boxscore: (gameId: string) => fetchJson<Boxscore>(`boxscores/${gameId}.json`),
  news: (season = SEASON) => fetchJson<NewsFile>(`news/${season}.json`),
};
