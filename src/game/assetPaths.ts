/** Normalize display names to asset filename prefixes (e.g. KAY/O → KAYO). */
export function agentAssetName(displayName: string): string {
  return displayName.replace(/\//g, "").replace(/\s+/g, "");
}

export function agentBackgroundPath(displayName: string): string {
  return `/backgrounds/${agentAssetName(displayName)}_Background_Text.png`;
}

export function randomBackgroundPath(): string {
  return "/backgrounds/Random_Background_Text.png";
}

export function randomPortraitPath(): string {
  return "/portraits/Random_VALORANT_Portrait.png";
}

export function agentNpcPath(displayName: string): string {
  return `/npc/${agentAssetName(displayName)}_NPC.png`;
}

export function agentPortraitPath(displayName: string): string {
  return `/portraits/${agentAssetName(displayName)}_VALORANT_Portrait.png`;
}

export function abilityIconPath(agentSlug: string, fileName: string): string {
  return `/abilities/${agentSlug}/${fileName}.png`;
}

export function mapLoadingPath(mapName: string): string {
  return `/maps/Loading_Screen_${mapName}.png`;
}

/** Default tactical map art used as the board backdrop. */
export const DEFAULT_BOARD_MAP = "Ascent";

export function boardMapBackgroundPath(mapName: string = DEFAULT_BOARD_MAP): string {
  return mapLoadingPath(mapName);
}

export function spikeIconPath(): string {
  return "/spike/Spike.png";
}

export function defuserIconPath(): string {
  return "/spike/Defuser.png";
}

export function pointsIconPath(kind: "creds" | "radianite" | "kingdom" | "vp"): string {
  switch (kind) {
    case "creds":
      return "/points/Credits_icon.png";
    case "radianite":
      return "/points/Radianite_Points.png";
    case "kingdom":
      return "/points/Kingdom_Credits.png";
    case "vp":
      return "/points/Valorant_Points.png";
  }
}

export function roleSymbolPath(
  role: "duelist" | "initiator" | "controller" | "sentinel"
): string {
  const map = {
    duelist: "DuelistClassSymbol",
    initiator: "InitiatorClassSymbol",
    controller: "ControllerClassSymbol",
    sentinel: "SentinelClassSymbol",
  };
  return `/roles/${map[role]}.png`;
}

const AGENTS_WITH_NPC = new Set([
  "Astra",
  "Breach",
  "Brimstone",
  "Chamber",
  "Cypher",
  "Fade",
  "Jett",
  "KAY/O",
  "Killjoy",
  "Neon",
  "Omen",
  "Phoenix",
  "Raze",
  "Reyna",
  "Sage",
  "Skye",
  "Sova",
  "Viper",
  "Yoru",
]);

export type StoryArtVariant = "npc" | "portrait";

export function agentHasNpcModel(agentName: string): boolean {
  return AGENTS_WITH_NPC.has(agentName);
}

/** Prefer full-body NPC art; fall back to portrait for agents without NPC files. */
export function resolveAgentStoryArt(agentName: string): {
  src: string;
  variant: StoryArtVariant;
} {
  if (agentHasNpcModel(agentName)) {
    return { src: agentNpcPath(agentName), variant: "npc" };
  }
  return { src: agentPortraitPath(agentName), variant: "portrait" };
}
