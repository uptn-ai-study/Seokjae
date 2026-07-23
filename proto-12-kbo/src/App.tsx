import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: '홈', end: true },
  { to: '/schedule', label: '경기' },
  { to: '/standings', label: '순위' },
  { to: '/players', label: '선수' },
  { to: '/news', label: '뉴스심리' },
];

export function App() {
  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <span className="app-header__title">⚾ KBO 데이터 뷰어</span>
          <nav className="app-nav" aria-label="주요 메뉴">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        데이터 출처: KBO 공식 홈페이지 (koreabaseball.com). 기록의 저작권은 KBO에 있으며, 본
        사이트는 비상업적 학습용입니다. 데이터는 수집 시점 기준이며 실제 기록과 차이가 있을 수
        있습니다.
      </footer>
    </>
  );
}
