import type { ReactNode } from 'react';
import styles from './states.module.css';

/** 로딩 스켈레톤 */
export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className={styles.box} role="status" aria-live="polite">
      <div className={styles.skeleton} />
      <div className={styles.skeleton} style={{ width: '70%' }} />
      <div className={styles.skeleton} style={{ width: '85%' }} />
      <span className={styles.srOnly}>{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className={`${styles.box} ${styles.error}`} role="alert">
      <p>데이터를 불러오지 못했습니다.</p>
      <p className={styles.detail}>{error.message}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className={`${styles.box} ${styles.empty}`}>{children}</div>;
}
