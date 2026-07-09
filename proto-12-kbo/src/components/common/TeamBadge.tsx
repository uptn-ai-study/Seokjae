import styles from './TeamBadge.module.css';
import { teamInfo } from '../../lib/teams';

/** 팀 컬러 칩 + 팀명 */
export function TeamBadge({
  teamId,
  teamName,
  size = 'md',
}: {
  teamId: string | null;
  teamName?: string;
  size?: 'sm' | 'md';
}) {
  const t = teamInfo(teamId, teamName);
  return (
    <span className={`${styles.badge} ${size === 'sm' ? styles.sm : ''}`}>
      <span className={styles.chip} style={{ background: t.color }} aria-hidden="true">
        {t.name.slice(0, 2)}
      </span>
      <span className={styles.name}>{teamName ?? t.name}</span>
    </span>
  );
}
