import { useMemo, useState } from 'react';
import { dataClient } from '../../api/dataClient';
import { useData } from '../../api/useData';
import { Empty, ErrorBox, Loading } from '../../components/common/states';
import { TeamBadge } from '../../components/common/TeamBadge';
import { computeMomentum, predictGames } from '../../lib/momentum';
import { fmtDateFull } from '../../lib/format';
import { teamInfo } from '../../lib/teams';
import type { NewsArticle, TeamNews } from '../../types/kbo';
import styles from './NewsPage.module.css';

const LABEL_TEXT = { pos: '긍정', neg: '부정', neu: '중립' } as const;

function ymdDash(ymd: string) {
  return `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`;
}

function articleDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** 긍정/부정 발산형 막대 (가운데 0, 왼쪽 부정·오른쪽 긍정) */
function SentimentBar({ pos, neg, max }: { pos: number; neg: number; max: number }) {
  const scale = (v: number) => `${(v / max) * 50}%`;
  return (
    <div className={styles.sentBar} aria-hidden="true">
      <div className={styles.sentHalf}>
        <span className={styles.sentNeg} style={{ width: scale(neg) }} />
      </div>
      <div className={styles.sentAxis} />
      <div className={styles.sentHalf}>
        <span className={styles.sentPos} style={{ width: scale(pos) }} />
      </div>
    </div>
  );
}

function ArticleRow({ a }: { a: NewsArticle }) {
  return (
    <li className={styles.article}>
      {a.multiTeam ? (
        <span className={`${styles.tag} ${styles.tag_multi}`} title="여러 팀이 함께 언급되어 점수에서 제외(참고)">
          여러 팀
        </span>
      ) : (
        <span className={`${styles.tag} ${styles[`tag_${a.label}`]}`}>{LABEL_TEXT[a.label]}</span>
      )}
      <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.articleTitle}>
        {a.title}
      </a>
      <span className={styles.articleMeta}>
        {a.outlet}
        {a.publishedAt ? ` · ${articleDate(a.publishedAt)}` : ''}
      </span>
    </li>
  );
}

function TeamCard({ team, rank, maxScore }: { team: TeamNews; rank: number; maxScore: number }) {
  const [open, setOpen] = useState(false);
  const t = teamInfo(team.teamId, team.teamName);
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.rank}>{rank}</span>
        <TeamBadge teamId={team.teamId} teamName={team.teamName} />
        <span className={styles.net} style={{ color: team.netScore >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}>
          {team.netScore > 0 ? '+' : ''}
          {team.netScore}
        </span>
      </div>
      <SentimentBar pos={team.positiveScore} neg={team.negativeScore} max={maxScore} />
      <div className={styles.counts}>
        <span className={styles.posText}>긍정 {team.posArticles}</span>
        <span className={styles.neuText}>중립 {team.neuArticles}</span>
        <span className={styles.negText}>부정 {team.negArticles}</span>
      </div>
      <div className={styles.basis}>
        단일 팀 기사 {team.singleTeamArticles}건 집계
        {team.multiTeamArticles > 0 ? ` · 여러 팀 ${team.multiTeamArticles}건 참고(제외)` : ''}
      </div>
      <p className={styles.summary}>{team.summary}</p>
      {team.articles.length > 0 && (
        <>
          <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            대표 기사 {team.articles.length}건 {open ? '접기 ▲' : '보기 ▼'}
          </button>
          {open && (
            <ul className={styles.articles}>
              {team.articles.map((a, i) => (
                <ArticleRow key={i} a={a} />
              ))}
            </ul>
          )}
        </>
      )}
      <span className={styles.accent} style={{ background: t.color }} aria-hidden="true" />
    </div>
  );
}

export function NewsPage() {
  const news = useData(() => dataClient.news());
  const standings = useData(() => dataClient.standings());

  const ranked = useMemo(
    () => (news.data ? [...news.data.teams].sort((a, b) => b.netScore - a.netScore) : []),
    [news.data],
  );
  const maxScore = useMemo(
    () => Math.max(1, ...ranked.map((t) => Math.max(t.positiveScore, t.negativeScore))),
    [ranked],
  );
  const predictions = useMemo(() => {
    if (!news.data || !standings.data) return [];
    const mom = computeMomentum(news.data.teams, standings.data.standings);
    return predictGames(news.data.upcomingGames.games, mom).map((p) => ({
      ...p,
      awayName: news.data!.upcomingGames.games.find((g) => g.gameId === p.gameId)?.awayTeamName ?? p.away.teamName,
      homeName: news.data!.upcomingGames.games.find((g) => g.gameId === p.gameId)?.homeTeamName ?? p.home.teamName,
    }));
  }, [news.data, standings.data]);

  if (news.loading) return <Loading label="뉴스 심리를 불러오는 중" />;
  if (news.error) return <ErrorBox error={news.error} onRetry={news.retry} />;
  if (!news.data) return <Empty>뉴스 데이터가 없습니다.</Empty>;

  const d = news.data;
  return (
    <div>
      <h1 className="page-title">뉴스 심리 · 다음 경기 예측</h1>
      <p className={styles.window}>
        데이터 기준일 <strong>{fmtDateFull(d.asOf)}</strong> · 최근 {d.window.days}일 (
        {ymdDash(d.window.from)}~{ymdDash(d.window.to)}) 국내 주요 언론 {d.outletCount}개사 기사 기준
      </p>
      <div className={styles.disclaimer} role="note">
        ⚠ <strong>단일 팀만 언급된 기사</strong>만 사전(키워드) 감성으로 집계합니다. 여러 팀이 함께
        나온 경기 기사는 어느 팀의 호재/악재인지 사전만으로 가릴 수 없어 <strong>중립(참고)</strong>으로
        빼둡니다(승패는 순위·최근 폼이 반영). 문맥·반어는 여전히 못 잡으니 <strong>재미로 보는 실험적
        지표이며 실제 승부 예측이 아닙니다.</strong>
      </div>

      <h2 className="section-title">뉴스로 본 순위 (긍정−부정)</h2>
      <div className={styles.grid}>
        {ranked.map((team, i) => (
          <TeamCard key={team.teamId} team={team} rank={i + 1} maxScore={maxScore} />
        ))}
      </div>

      <h2 className="section-title">
        다음 경기 예측 <span className={styles.expTag}>실험적</span>
      </h2>
      {predictions.length === 0 ? (
        <Empty>예측할 다음 경기 일정이 없습니다.</Empty>
      ) : (
        <>
          {d.upcomingGames.date && (
            <p className={styles.window}>{fmtDateFull(d.upcomingGames.date)} 경기 · 최근 폼(최근 10경기) + 뉴스 심리 결합 모멘텀</p>
          )}
          <div className={styles.predGrid}>
            {predictions.map((p) => {
              const awayFav = p.favoredTeamId === p.away.teamId;
              return (
                <div key={p.gameId} className={styles.pred}>
                  <div className={`${styles.predSide} ${awayFav ? styles.fav : ''}`}>
                    <TeamBadge teamId={p.away.teamId} teamName={p.awayName} size="sm" />
                    <span className={styles.predPct}>{100 - p.homeWinPct}%</span>
                  </div>
                  <div className={styles.predVs}>
                    <MomentumMini away={p.away.momentum} home={p.home.momentum} />
                    <span className={styles.predAt}>원정 · 홈</span>
                  </div>
                  <div className={`${styles.predSide} ${!awayFav ? styles.fav : ''}`}>
                    <TeamBadge teamId={p.home.teamId} teamName={p.homeName} size="sm" />
                    <span className={styles.predPct}>{p.homeWinPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className={styles.note}>
            숫자는 모멘텀 차이에 소폭의 홈 이점을 더해 계산한 승리 확률(실험적)입니다.
          </p>
        </>
      )}

      <h2 className="section-title">참고 언론사 ({d.outletCount}개사)</h2>
      <div className={styles.outlets}>
        {d.outlets.map((cat) => (
          <div key={cat.category} className={styles.outletCat}>
            <span className={styles.outletCatName}>{cat.category}</span>
            <div className={styles.chips}>
              {cat.names.map((name) => (
                <span key={name} className={styles.chip}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        기사 저작권은 각 언론사에 있으며, 제목·출처·링크만 인용합니다. 수집: 구글 뉴스 · 감성:
        사전(lexicon) 기반. 생성 {new Date(d.generatedAt).toLocaleString('ko-KR')}.
      </p>
    </div>
  );
}

/** 두 팀 모멘텀을 좌우 미니 막대로 */
function MomentumMini({ away, home }: { away: number; home: number }) {
  const bar = (v: number) => {
    const pct = Math.min(100, Math.abs(v) * 100);
    return { width: `${pct}%`, background: v >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' };
  };
  return (
    <div className={styles.momMini} title="모멘텀(−1~+1)">
      <span className={styles.momLeft}>
        <span style={bar(away)} />
      </span>
      <span className={styles.momMid} />
      <span className={styles.momRight}>
        <span style={bar(home)} />
      </span>
    </div>
  );
}
