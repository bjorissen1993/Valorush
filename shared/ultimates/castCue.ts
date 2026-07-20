/** Ultimate cast presentation cue — synced via online snapshot for guests. */

export type UltimateCastTheme =
  | "orbital"
  | "poison"
  | "shadow"
  | "lockdown"
  | "glitch"
  | "bolt"
  | "heal"
  | "rewind"
  | "blade"
  | "empress"
  | "explosion"
  | "thunder"
  | "seekers"
  | "flicker"
  | "wall"
  | "null"
  | "duel"
  | "overdrive"
  | "nightfall"
  | "shield"
  | "trap"
  | "generic";

export type UltimateCastCue = {
  /** Unique id so clients play each cast once. */
  id: string;
  agentName: string;
  ultimateId: string;
  ultimateName: string;
  casterPlayerIndex: number;
  casterName: string;
  theme: UltimateCastTheme;
  highlightNodeIds: string[];
  highlightPlayerIndices: number[];
  /** Ability icon under /abilities when available. */
  iconUrl?: string;
  /** Presentation length before auto-dismiss (1.5–3s). */
  durationMs: number;
};

const THEME_BY_ULTIMATE_ID: Record<string, UltimateCastTheme> = {
  "orbital-strike": "orbital",
  "vipers-pit": "poison",
  "from-the-shadows": "shadow",
  lockdown: "lockdown",
  "neural-theft": "glitch",
  "hunters-fury": "bolt",
  resurrection: "heal",
  "run-it-back": "rewind",
  "blade-storm": "blade",
  empress: "empress",
  showstopper: "explosion",
  "rolling-thunder": "thunder",
  seekers: "seekers",
  "dimensional-drift": "flicker",
  "cosmic-divide-ult": "wall",
  "null-cmd": "null",
  "tour-de-force": "duel",
  overdrive: "overdrive",
  nightfall: "nightfall",
  "not-dead-yet": "shield",
  "steel-garden": "trap",
};

export function themeForUltimateId(ultimateId: string): UltimateCastTheme {
  return THEME_BY_ULTIMATE_ID[ultimateId] ?? "generic";
}

export function defaultCastDurationMs(theme: UltimateCastTheme): number {
  switch (theme) {
    case "orbital":
    case "explosion":
    case "thunder":
    case "nightfall":
      return 2500;
    case "bolt":
    case "seekers":
    case "wall":
      return 2300;
    case "shadow":
    case "flicker":
    case "rewind":
      return 2200;
    default:
      return 2000;
  }
}
