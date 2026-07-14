/** Custom Match definitions — scheduled at end of round via board events. */

export type ValorantMapId =
  | "Bind"
  | "Ascent"
  | "Split"
  | "Lotus"
  | "Pearl"
  | "Sunset"
  | "Icebox"
  | "Fracture"
  | "Abyss"
  | "Corrode";

export type CustomMatchId =
  | "spike-rush"
  | "tdm"
  | "escalation"
  | "pistol-round"
  | "sheriff-duel"
  | "operator-only"
  | "knife-fight";

export type CustomMatchDefinition = {
  id: CustomMatchId;
  name: string;
  description: string;
  rulesStub: string;
  /** Preferred maps for this mode; one is picked at schedule time. */
  maps: ValorantMapId[];
  winCreds: number;
  winRadianite: number;
  durationLabel: string;
};

export type CustomMatchStatus =
  | "scheduled"
  | "revealed"
  | "in_progress"
  | "completed";

/** Persisted custom match state — ready for future Riot API fields. */
export type ScheduledCustomMatch = {
  matchId: CustomMatchId;
  mapId: ValorantMapId;
  scheduledAtRound: number;
  status: CustomMatchStatus;
  participants: string[];
  winnerPlayerIndex?: number;
  /** Future: riotLobbyId, riotMatchId, etc. */
};

/** @deprecated Use ScheduledCustomMatch */
export type ActiveCustomMatch = {
  matchId: CustomMatchId;
  mapId: ValorantMapId;
  scheduledRound: number;
};
