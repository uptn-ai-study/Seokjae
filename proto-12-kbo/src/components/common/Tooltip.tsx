import { useId, useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

/**
 * 물음표 아이콘 툴팁. 터치(클릭)와 호버, 키보드 포커스 모두 지원.
 */
export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={styles.wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-describedby={open ? id : undefined}
        aria-label="용어 설명 보기"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
      >
        {label}
      </button>
      {open && (
        <span role="tooltip" id={id} className={styles.bubble}>
          {children}
        </span>
      )}
    </span>
  );
}
