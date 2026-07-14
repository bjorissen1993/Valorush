import {
  agentHasNpcModel,
  agentHasPortrait,
  isEventEligibleAgent,
} from "../../shared/availableAgents";

export {
  agentHasNpcModel,
  agentHasPortrait,
  isEventEligibleAgent,
};

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

import { getMapSplashPath } from "../../shared/customMatches/mapRegistry";
import type { ValorantMapId } from "../../shared/customMatches/types";

export function mapLoadingPath(mapName: string): string {
  return getMapSplashPath(mapName as ValorantMapId);
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

export type StoryArtVariant = "npc" | "portrait";

/** Prefer full-body NPC art; fall back to portrait for agents without NPC files. */
export function resolveAgentStoryArt(agentName: string): {
  src: string;
  variant: StoryArtVariant;
} {
  if (agentHasNpcModel(agentName)) {
    return { src: agentNpcPath(agentName), variant: "npc" };
  }
  if (agentHasPortrait(agentName)) {
    return { src: agentPortraitPath(agentName), variant: "portrait" };
  }
  return { src: randomPortraitPath(), variant: "portrait" };
}

/** Portrait ring image for director UI — never 404s on missing assets. */
export function resolveAgentPortraitImage(agentName: string): string {
  if (agentHasPortrait(agentName)) {
    return agentPortraitPath(agentName);
  }
  return resolveAgentStoryArt(agentName).src;
}
