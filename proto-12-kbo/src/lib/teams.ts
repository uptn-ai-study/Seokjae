/** 팀 코드 → 표기/컬러. 정규화 데이터의 teamId 와 대응 */
export interface TeamInfo {
  id: string;
  name: string;
  fullName: string;
  color: string;
}

export const TEAMS: Record<string, TeamInfo> = {
  LG: { id: 'LG', name: 'LG', fullName: 'LG 트윈스', color: '#C30452' },
  OB: { id: 'OB', name: '두산', fullName: '두산 베어스', color: '#1A1748' },
  SK: { id: 'SK', name: 'SSG', fullName: 'SSG 랜더스', color: '#CE0E2D' },
  WO: { id: 'WO', name: '키움', fullName: '키움 히어로즈', color: '#820024' },
  SS: { id: 'SS', name: '삼성', fullName: '삼성 라이온즈', color: '#074CA1' },
  HT: { id: 'HT', name: 'KIA', fullName: 'KIA 타이거즈', color: '#EA0029' },
  LT: { id: 'LT', name: '롯데', fullName: '롯데 자이언츠', color: '#041E42' },
  NC: { id: 'NC', name: 'NC', fullName: 'NC 다이노스', color: '#315288' },
  KT: { id: 'KT', name: 'KT', fullName: 'KT 위즈', color: '#231F20' },
  HH: { id: 'HH', name: '한화', fullName: '한화 이글스', color: '#F37321' },
};

export function teamInfo(teamId: string | null, fallbackName = '?'): TeamInfo {
  if (teamId && TEAMS[teamId]) return TEAMS[teamId];
  return { id: teamId ?? '?', name: fallbackName, fullName: fallbackName, color: '#8a93a0' };
}
