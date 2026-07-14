/** Custom Match definitions — scheduled at end of round via board events. */

export type ValorantMapId =
  | "Abyss"
  | "Ascent"
  | "Bind"
  | "Breeze"
  | "Corrode"
  | "District"
  | "Drift"
  | "Fracture"
  | "Glitch"
  | "Haven"
  | "Icebox"
  | "Kasbah"
  | "Lotus"
  | "Pearl"
  | "Piazza"
  | "Split"
  | "Summit"
  | "Sunset"
  | "Skirmish A"
  | "Skirmish B"
  | "Skirmish C"
  | "Skirmish D"
  | "Skirmish E";

/** Valorant custom-game modes available in ValoRush. */
export type CustomMatchId =
  | "swiftplay"
  | "all-random-one-site"
  | "standard"
  | "deathmatch"
  | "retake"
  | "escalation"
  | "team-deathmatch"
  | "spike-rush"
  | "skirmish";

export type CustomMatchCategory = "free_for_all" | "2v2" | "1v3";

export type CustomMatchDefinition = {
  id: CustomMatchId;
  name: string;
  category: CustomMatchCategory;
  /** Short label for lobby UI, e.g. "4 FFA", "2v2", "1v3". */
  playerFormat: string;
  description: string;
  rulesStub: string;
  /** Maps with local splash assets; one is picked at schedule time. */
  eligibleMaps: ValorantMapId[];
  winCreds: number;
  winRadianite: number;
  durationLabel: string;
};

export type CustomMatchStatus =
  | "scheduled"
  | "revealed"
  | "in_progress"
  | "completed";

/** Team layout for 2v2 modes — player indices into the live roster. */
export type CustomMatchTeamLayout = {
  teamAlpha: number[];
  teamBravo: number[];
};

/** Side layout for 1v3 modes — one attacker vs up to three defenders. */
export type CustomMatchSideLayout = {
  attackerIndex: number;
  defenderIndices: number[];
};

/** Persisted custom match state — ready for future Riot API fields. */
export type ScheduledCustomMatch = {
  matchId: CustomMatchId;
  mapId: ValorantMapId;
  scheduledAtRound: number;
  status: CustomMatchStatus;
  participants: string[];
  /** 2v2 — balanced random split at schedule time. */
  teamAlpha?: number[];
  teamBravo?: number[];
  /** 1v3 — one attacker vs defenders. */
  attackerIndex?: number;
  defenderIndices?: number[];
  winnerPlayerIndex?: number;
  winnerTeam?: "alpha" | "bravo";
  winnerSide?: "attackers" | "defenders";
  /** Future: riotLobbyId, riotMatchId, etc. */
};

/** @deprecated Use ScheduledCustomMatch */
export type ActiveCustomMatch = {
  matchId: CustomMatchId;
  mapId: ValorantMapId;
  scheduledRound: number;
};
