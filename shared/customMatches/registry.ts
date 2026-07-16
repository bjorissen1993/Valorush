import {
  competitiveMapsWithAssets,
  mapsInPoolWithAssets,
  pickRandomFromMaps,
} from "./mapRegistry";
import type { CustomMatchDefinition } from "./types";

const competitive = competitiveMapsWithAssets();
const arOS = mapsInPoolWithAssets("arOS");
const retake = mapsInPoolWithAssets("retake");
const tdm = mapsInPoolWithAssets("tdm");
const skirmish = mapsInPoolWithAssets("skirmish");

/** All nine Valorant custom-game modes, grouped by ValoRush category. */
export const customMatchRegistry: CustomMatchDefinition[] = [
  // ── Free for All ────────────────────────────────────────────────────────
  {
    id: "deathmatch",
    name: "Deathmatch",
    category: "free_for_all",
    playerFormat: "12 FFA",
    description: "First to 40 eliminations — pure aim and tempo on a standard map.",
    rulesStub: "Free-for-all scramble. Host confirms the winning player after the match.",
    eligibleMaps: competitive,
    winCreds: 175,
    winRadianite: 1,
    durationLabel: "1 match",
  },
  {
    id: "escalation",
    name: "Escalation",
    category: "free_for_all",
    playerFormat: "5v5 FFA teams",
    description: "Weapons escalate each round — race to the final tier.",
    rulesStub: "Escalating weapons. Host confirms the winning player after the match.",
    eligibleMaps: competitive,
    winCreds: 150,
    winRadianite: 2,
    durationLabel: "1 match",
  },

  // ── 2v2 ─────────────────────────────────────────────────────────────────
  {
    id: "spike-rush",
    name: "Spike Rush",
    category: "2v2",
    playerFormat: "2v2",
    description:
      "Fast spike rounds — Team Alpha vs Team Bravo, chaotic economy swings.",
    rulesStub:
      "Team Alpha vs Team Bravo. Host confirms the winning team after the match.",
    eligibleMaps: competitive,
    winCreds: 200,
    winRadianite: 1,
    durationLabel: "4 rounds",
  },
  {
    id: "team-deathmatch",
    name: "Team Deathmatch",
    category: "2v2",
    playerFormat: "2v2",
    description: "Elimination scramble on a TDM arena — two teams, pure tempo.",
    rulesStub: "Two teams of two. Host confirms the winning team after the match.",
    eligibleMaps: tdm,
    winCreds: 175,
    winRadianite: 1,
    durationLabel: "1 match",
  },
  {
    id: "skirmish",
    name: "Skirmish",
    category: "2v2",
    playerFormat: "2v2",
    description: "Close-quarters duels on compact Skirmish arenas.",
    rulesStub: "Two teams of two. Host confirms the winning team after the match.",
    eligibleMaps: skirmish,
    winCreds: 200,
    winRadianite: 1,
    durationLabel: "1 match",
  },

  // ── 1v3 (site hold / plant-defuse) ──────────────────────────────────────
  {
    id: "standard",
    name: "Standard",
    category: "1v3",
    playerFormat: "1v3",
    description: "Classic plant/defuse — one attacker vs three defenders on a full map.",
    rulesStub: "One attacker vs three defenders. Host confirms the winning side.",
    eligibleMaps: competitive,
    winCreds: 225,
    winRadianite: 1,
    durationLabel: "1–13 rounds",
  },
  {
    id: "retake",
    name: "Retake",
    category: "1v3",
    playerFormat: "1v3 retake",
    description: "Spike planted — retake the site as attackers outnumbered on defense.",
    rulesStub: "One attacker vs three defenders. Host confirms the winning side.",
    eligibleMaps: retake,
    winCreds: 200,
    winRadianite: 1,
    durationLabel: "5 rounds",
  },
  {
    id: "all-random-one-site",
    name: "All Random One Site",
    category: "1v3",
    playerFormat: "1v3 single site",
    description: "Random agents, one bombsite — one attacker vs three defenders.",
    rulesStub: "One attacker vs three defenders. Host confirms the winning side.",
    eligibleMaps: arOS,
    winCreds: 200,
    winRadianite: 1,
    durationLabel: "5 rounds",
  },
  {
    id: "swiftplay",
    name: "Swiftplay",
    category: "1v3",
    playerFormat: "1v3 fast",
    description: "Accelerated Standard — shorter rounds, faster buys, same 1v3 tension.",
    rulesStub: "One attacker vs three defenders. Host confirms the winning side.",
    eligibleMaps: competitive,
    winCreds: 175,
    winRadianite: 1,
    durationLabel: "5 rounds",
  },
];

export const customMatchById = new Map(
  customMatchRegistry.map((entry) => [entry.id, entry])
);

export const CUSTOM_MATCH_CATEGORY_LABELS: Record<
  CustomMatchDefinition["category"],
  string
> = {
  free_for_all: "Free for All",
  "2v2": "2v2",
  "1v3": "1v3",
};

export function pickRandomMapForMatch(matchId: string): string {
  const resolvedId = resolveCustomMatchId(matchId);
  const match = customMatchById.get(resolvedId);
  if (!match || match.eligibleMaps.length === 0) return "Ascent";
  return pickRandomFromMaps(match.eligibleMaps);
}

/** @deprecated Use `team-deathmatch` — kept for older event payloads. */
export const LEGACY_MATCH_ID_ALIASES: Record<string, CustomMatchDefinition["id"]> = {
  tdm: "team-deathmatch",
};

export function resolveCustomMatchId(matchId: string): CustomMatchDefinition["id"] {
  return (
    LEGACY_MATCH_ID_ALIASES[matchId] ??
    (matchId as CustomMatchDefinition["id"])
  );
}

export function getCustomMatchDefinition(
  matchId: string
): CustomMatchDefinition | undefined {
  return customMatchById.get(resolveCustomMatchId(matchId));
}
