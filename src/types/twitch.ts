/** A Twitch account returned from Helix search or user lookup. */
export type TwitchSearchResult = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl?: string;
};
