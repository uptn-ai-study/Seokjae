import { createHashRouter } from 'react-router-dom';
import { App } from './App';
import { HomePage } from './features/home/HomePage';
import { SchedulePage } from './features/schedule/SchedulePage';
import { StandingsPage } from './features/standings/StandingsPage';
import { PlayersPage } from './features/players/PlayersPage';
import { GameDetailPage } from './features/game-detail/GameDetailPage';
import { NewsPage } from './features/news/NewsPage';

/** 정적 호스팅(서버 리라이트 불가) 호환을 위해 hash 라우터 사용 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'standings', element: <StandingsPage /> },
      { path: 'players', element: <PlayersPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'games/:gameId', element: <GameDetailPage /> },
    ],
  },
]);
