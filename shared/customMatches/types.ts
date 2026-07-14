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

export type ActiveCustomMatch = {
  matchId: CustomMatchId;
  mapId: ValorantMapId;
  scheduledRound: number;
};
