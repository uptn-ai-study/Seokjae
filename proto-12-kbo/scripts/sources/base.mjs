/**
 * DataSource 어댑터 인터페이스.
 *
 * 모든 데이터 소스(공식 홈페이지 크롤러 / CSV 아카이브 / 상용 API)는
 * 이 형태를 구현해 교체 가능해야 한다. 파이프라인(build_dataset)은
 * 이 인터페이스에만 의존한다.
 *
 * @typedef {Object} DataSource
 * @property {string} name
 * @property {(opts: {season: number, from?: string, to?: string}) => Promise<object[]>} fetchGames
 *   정규화 이전의 "소스 레코드" 배열 반환 (normalize.mjs 가 스키마로 변환)
 * @property {(opts: {season: number}) => Promise<{hitters: object[], pitchers: object[]}>} fetchPlayers
 * @property {(opts: {season: number, gameIds: string[]}) => Promise<Record<string, object>>} [fetchBoxscores]
 */

const registry = new Map();

export function registerSource(source) {
  registry.set(source.name, source);
}

export function getSource(name) {
  const s = registry.get(name);
  if (!s) throw new Error(`unknown data source: ${name} (registered: ${[...registry.keys()].join(', ')})`);
  return s;
}

/** 파이프라인 스모크 테스트용 더미 소스 */
registerSource({
  name: 'dummy',
  async fetchGames() {
    return [
      {
        gameId: '20260101TESTA0', date: '20260101', season: 2026, seriesId: 0,
        stadium: '테스트', status: 'finished', awayTeamId: 'LG', homeTeamId: 'OB',
        awayScore: 3, homeScore: 5, awayTeamName: 'LG', homeTeamName: '두산',
      },
    ];
  },
  async fetchPlayers() {
    return { hitters: [], pitchers: [] };
  },
});
