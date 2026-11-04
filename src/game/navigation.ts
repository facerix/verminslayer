/** Public mission links use the extensionless route on both dev and production servers. */
export const gameUrl = (missionId: string): string => `/game?id=${encodeURIComponent(missionId)}`;

export const missionIdFromSearch = (search: string): string => {
  const missionId = new URLSearchParams(search).get('id');
  if (!missionId) throw new Error('A mission id is required in the game URL');
  return missionId;
};
