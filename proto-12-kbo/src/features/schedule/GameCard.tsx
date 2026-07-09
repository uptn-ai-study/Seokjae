import { Link } from 'react-router-dom';
import type { Game } from '../../types/kbo';
import { teamInfo } from '../../lib/teams';
import styles from './GameCard.module.css';

const STATUS_LABEL: Record<Game['status'], string> = {
  scheduled: '경기 전',
  live: '진행 중',
  finished: '종료',
  canceled: '취소',
  suspended: '서스펜디드',
};

function Side({
  teamId,
  teamName,
  score,
  win,
}: {
  teamId: string;
  teamName: string;
  score: number | null;
  win: boolean;
}) {
  const t = teamInfo(teamId, teamName);
  return (
    <div className={`${styles.side} ${win ? styles.winner : ''}`}>
      <span className={styles.chip} style={{ background: t.color }} aria-hidden="true">
        {t.name.slice(0, 2)}
      </span>
      <span className={styles.team}>{teamName}</span>
      <span className={styles.score}>{score ?? '-'}</span>
    </div>
  );
}

/** 경기 카드: 원정(위)/홈(아래), 승팀 강조, 클릭 시 박스스코어 */
export function GameCard({ game }: { game: Game }) {
  const finished = game.status === 'finished';
  const showScore = finished || game.status === 'live' || game.status === 'suspended';
  const awayWin = finished && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWin = finished && (game.home.score ?? 0) > (game.away.score ?? 0);

  const body = (
    <>
      <div className={styles.meta}>
        <span>{game.stadium}</span>
        <span
          className={`${styles.status} ${game.status === 'live' ? styles.live : ''} ${game.status === 'canceled' ? styles.canceled : ''}`}
        >
          {game.status === 'canceled' && game.cancelReason
            ? `취소 (${game.cancelReason})`
            : STATUS_LABEL[game.status]}
        </span>
        <span>{game.time}</span>
      </div>
      <Side teamId={game.away.teamId} teamName={game.away.teamName} score={showScore ? game.away.score : null} win={awayWin} />
      <Side teamId={game.home.teamId} teamName={game.home.teamName} score={showScore ? game.home.score : null} win={homeWin} />
      {finished && (game.winPitcher || game.losePitcher) && (
        <div className={styles.pitchers}>
          {game.winPitcher && <span>승 {game.winPitcher}</span>}
          {game.savePitcher && <span>세 {game.savePitcher}</span>}
          {game.losePitcher && <span>패 {game.losePitcher}</span>}
        </div>
      )}
      {finished && game.hasBoxscore && <div className={styles.more}>박스스코어 보기 →</div>}
    </>
  );

  if (finished && game.hasBoxscore) {
    return (
      <Link
        to={`/games/${game.gameId}`}
        className={`${styles.card} ${styles.link}`}
        aria-label={`${game.away.teamName} 대 ${game.home.teamName} 박스스코어 보기`}
      >
        {body}
      </Link>
    );
  }
  return <div className={styles.card}>{body}</div>;
}
