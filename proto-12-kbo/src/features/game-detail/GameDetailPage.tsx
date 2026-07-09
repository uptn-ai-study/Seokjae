import { Link, useParams } from 'react-router-dom';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { fmtDate } from '../../lib/format';
import type { Game, Matrix } from '../../types/kbo';
import styles from './GameDetailPage.module.css';

/** 과거 수집분에 남아 있을 수 있는 HTML 엔티티 정리 */
function clean(cell: string): string {
  return cell
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** 수집된 표(문자열 매트릭스)를 그대로 렌더 */
function MatrixTable({
  matrix,
  caption,
  firstColHeader = true,
}: {
  matrix: Matrix;
  caption: string;
  firstColHeader?: boolean;
}) {
  if (!matrix.rows.length) return null;
  return (
    <div className={styles.scroller} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        {matrix.headers.length > 0 && (
          <thead>
            {matrix.headers.map((hr, i) => (
              <tr key={i}>
                {hr.map((h, j) => (
                  <th key={j} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {matrix.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                firstColHeader && j === 0 ? (
                  <th key={j} scope="row">
                    {clean(cell)}
                  </th>
                ) : (
                  <td key={j}>{clean(cell)}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 이닝 라인스코어: 헤더(이닝 번호) + R/H/E/B 합계를 한 표로 합침 */
function LineScore({
  innings,
  totals,
  awayName,
  homeName,
}: {
  innings: Matrix;
  totals: Matrix;
  awayName: string;
  homeName: string;
}) {
  const inningHeader = innings.headers[0] ?? [];
  const totalHeader = totals.headers[0] ?? ['R', 'H', 'E', 'B'];
  const teams = [awayName, homeName];
  return (
    <div className={styles.scroller} role="region" aria-label="이닝별 득점" tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>이닝별 득점</caption>
        <thead>
          <tr>
            <th scope="col">팀</th>
            {inningHeader.map((h, i) => (
              <th key={`i${i}`} scope="col">
                {h}
              </th>
            ))}
            {totalHeader.map((h, i) => (
              <th key={`t${i}`} scope="col" className={styles.totalCol}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, r) => (
            <tr key={team}>
              <th scope="row">{team}</th>
              {(innings.rows[r] ?? []).map((cell, i) => (
                <td key={`i${i}`}>{cell}</td>
              ))}
              {(totals.rows[r] ?? []).map((cell, i) => (
                <td key={`t${i}`} className={styles.totalCol}>
                  <strong>{cell}</strong>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 수집기가 분리 저장한 타자 표(선수/이닝별/합계)를 한 표로 병합.
 * lineup=[타순,포지션,선수명], totals=[타수,득점,안타,타점,타율]
 */
function mergeHitterTables(h: { lineup: Matrix; byInning: Matrix; totals: Matrix }): Matrix {
  const inningHeader = h.byInning.headers[0] ?? [];
  return {
    headers: [['타순', '포지션', '선수명', ...inningHeader, '타수', '득점', '안타', '타점', '타율']],
    rows: h.lineup.rows.map((row, i) => [
      ...row,
      ...(h.byInning.rows[i] ?? []),
      ...(h.totals.rows[i] ?? []),
    ]),
  };
}

export function GameDetailPage() {
  const { gameId = '' } = useParams();
  const games = useData(() => dataClient.games());
  const box = useData(() => dataClient.boxscore(gameId), [gameId]);

  if (games.loading || box.loading) return <Loading label="박스스코어를 불러오는 중" />;

  const game: Game | undefined = games.data?.games.find((g) => g.gameId === gameId);

  if (box.error) {
    return (
      <div>
        <BackLink />
        {game ? (
          <Empty>
            이 경기의 박스스코어는 아직 수집되지 않았습니다.
            <br />
            (최근 경기 위주로 상세 기록을 제공합니다)
          </Empty>
        ) : (
          <ErrorBox error={box.error} onRetry={box.retry} />
        )}
      </div>
    );
  }
  if (!box.data) return <Empty>박스스코어가 없습니다.</Empty>;

  const b = box.data;
  const awayName = game?.away.teamName ?? b.meta.awayFullName;
  const homeName = game?.home.teamName ?? b.meta.homeFullName;

  return (
    <div>
      <BackLink />
      <h1 className="page-title">
        {game ? `${fmtDate(game.date)} · ` : ''}
        {awayName} {game?.away.score ?? ''} : {game?.home.score ?? ''} {homeName}
      </h1>
      <p className={styles.meta}>
        {b.meta.stadium && <span>{b.meta.stadium}</span>}
        {b.meta.crowd && <span>관중 {b.meta.crowd}</span>}
        {b.meta.startTime && (
          <span>
            {b.meta.startTime} ~ {b.meta.endTime} ({b.meta.duration})
          </span>
        )}
      </p>

      <h2 className="section-title">이닝별 득점</h2>
      <LineScore
        innings={b.lineScore.innings}
        totals={b.lineScore.totals}
        awayName={awayName}
        homeName={homeName}
      />

      {b.hitters.map((h, i) => (
        <section key={i}>
          <h2 className="section-title">{i === 0 ? awayName : homeName} 타자 기록</h2>
          <MatrixTable
            matrix={mergeHitterTables(h)}
            caption="타자 기록"
            firstColHeader={false}
          />
        </section>
      ))}

      {b.pitchers.map((p, i) => (
        <section key={i}>
          <h2 className="section-title">{i === 0 ? awayName : homeName} 투수 기록</h2>
          <MatrixTable matrix={p} caption="투수 기록" />
        </section>
      ))}

      {b.etc.rows.length > 0 && (
        <section>
          <h2 className="section-title">주요 기록</h2>
          <MatrixTable matrix={b.etc} caption="경기 주요 기록" />
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/schedule" className={styles.back}>
      ← 경기 목록으로
    </Link>
  );
}
