import { Tooltip } from '../common/Tooltip';
import { glossaryOf } from '../../content/glossary';

const DIRECTION_TEXT = {
  higher: '높을수록 좋아요',
  lower: '낮을수록 좋아요',
  neutral: '',
} as const;

/**
 * 지표 라벨 + 용어 사전 툴팁. glossary 에 없는 키는 라벨만 표시.
 */
export function StatLabel({ statKey, label }: { statKey: string; label?: string }) {
  const entry = glossaryOf(statKey);
  if (!entry) return <>{label ?? statKey}</>;
  const direction = DIRECTION_TEXT[entry.direction];
  return (
    <Tooltip label={label ?? entry.label}>
      <strong>
        {entry.korean} ({entry.label})
      </strong>
      <br />
      {entry.description}
      {direction && (
        <>
          <br />👉 {direction}
        </>
      )}
    </Tooltip>
  );
}
