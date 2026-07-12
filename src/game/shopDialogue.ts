import {
  getRelationship,
  type RelationshipKind,
} from "./agentRelationships";

export type ShopSpeechAccent =
  | "emerald"
  | "cyan"
  | "crimson"
  | "gold"
  | "violet"
  | "lime";

export type ShopkeeperDialogue = {
  speaker: string;
  text: string;
  accent: ShopSpeechAccent;
};

const KEEPER_ACCENT: Record<string, ShopSpeechAccent> = {
  Raze: "gold",
  Viper: "lime",
  Killjoy: "gold",
  Chamber: "gold",
  Cypher: "cyan",
  Brimstone: "crimson",
};

type DialoguePick = (ctx: { playerAgentName: string }) => string;

const KEEPER_LINES: Record<
  string,
  Partial<Record<RelationshipKind, DialoguePick[]>>
> = {
  Raze: {
    neutral: [
      ({ playerAgentName }) =>
        `Yo ${playerAgentName}! Kingdom creds only , grab something loud before the round starts.`,
      ({ playerAgentName }) =>
        `${playerAgentName}, welcome to the scrapyard. Everything here goes boom on a budget.`,
    ],
    ally: [
      ({ playerAgentName }) =>
        `${playerAgentName}! Perfect timing , I saved the fun stuff for someone who actually uses it.`,
      ({ playerAgentName }) =>
        `Hey ${playerAgentName}, browse fast. I wired today's deals myself.`,
    ],
    rival: [
      ({ playerAgentName }) =>
        `${playerAgentName}? Fine. Pay full price and don't touch my demo rack.`,
    ],
  },
  Viper: {
    neutral: [
      ({ playerAgentName }) =>
        `${playerAgentName}. Touch nothing you can't afford , and don't waste my time.`,
      ({ playerAgentName }) =>
        `The lab is open, ${playerAgentName}. Credits first, questions never.`,
    ],
    ally: [
      ({ playerAgentName }) =>
        `${playerAgentName}. Good. I already pulled options that won't slow you down.`,
      ({ playerAgentName }) =>
        `You're in my lab now, ${playerAgentName}. Take what you need and move.`,
    ],
    rival: [
      ({ playerAgentName }) =>
        `${playerAgentName}. I sell to everyone , but nothing here comes cheap for you.`,
    ],
  },
  Killjoy: {
    neutral: [
      ({ playerAgentName }) =>
        `Catalog's online, ${playerAgentName}. Pick efficiently , I hate restocking.`,
      ({ playerAgentName }) =>
        `${playerAgentName}, everything's labeled and priced. Don't mix up the loadout slots.`,
    ],
    ally: [
      ({ playerAgentName }) =>
        `${playerAgentName}! I tuned today's stock for someone who knows gear.`,
      ({ playerAgentName }) =>
        `Good to see you, ${playerAgentName}. The workshop rates are live.`,
    ],
    mentor: [
      ({ playerAgentName }) =>
        `${playerAgentName}, start with shields if you're unsure. I'll keep the rest running.`,
    ],
    rival: [
      ({ playerAgentName }) =>
        `${playerAgentName}, the workshop is open. Try not to break anything on the way out.`,
    ],
  },
  Chamber: {
    neutral: [
      ({ playerAgentName }) =>
        `${playerAgentName}. Precision has a price , choose like your rank depends on it.`,
      ({ playerAgentName }) =>
        `Welcome to the armory, ${playerAgentName}. Only Kingdom creds. No refunds.`,
    ],
    ally: [
      ({ playerAgentName }) =>
        `${playerAgentName}, I've curated today's selection. You have taste , use it.`,
    ],
    rival: [
      ({ playerAgentName }) =>
        `${playerAgentName}. The armory serves clients, not friends. Pay up.`,
    ],
  },
  Cypher: {
    neutral: [
      ({ playerAgentName }) =>
        `${playerAgentName}. Every purchase is logged. Spend wisely.`,
      ({ playerAgentName }) =>
        `Shop's open, ${playerAgentName}. Kingdom creds only , I track everything.`,
    ],
    ally: [
      ({ playerAgentName }) =>
        `${playerAgentName}. I flagged a few deals worth your credits today.`,
    ],
    rival: [
      ({ playerAgentName }) =>
        `${playerAgentName}. No special treatment. Buy what you can afford and leave.`,
    ],
  },
  Brimstone: {
    neutral: [
      ({ playerAgentName }) =>
        `${playerAgentName}, arm up. We've got rounds to win , spend smart.`,
      ({ playerAgentName }) =>
        `Garage is open, ${playerAgentName}. Grab your loadout and stay mission-ready.`,
    ],
    ally: [
      ({ playerAgentName }) =>
        `${playerAgentName}, good timing. I set aside gear that fits your role.`,
    ],
    mentor: [
      ({ playerAgentName }) =>
        `${playerAgentName} , load out like the team is counting on you. Because they are.`,
    ],
    rival: [
      ({ playerAgentName }) =>
        `${playerAgentName}. Shop's open, but don't expect me to hold your hand at checkout.`,
    ],
  },
};

const GENERIC_LINES: Record<RelationshipKind, DialoguePick[]> = {
  neutral: [
    ({ playerAgentName }) =>
      `Welcome, ${playerAgentName}. Kingdom creds only , pick your loadout and move out.`,
  ],
  ally: [
    ({ playerAgentName }) =>
      `${playerAgentName}, good to see you. Browse , I've picked today's best offers for you.`,
  ],
  mentor: [
    ({ playerAgentName }) =>
      `${playerAgentName}, take your time. I'll keep the good stock on the table for you.`,
  ],
  rival: [
    ({ playerAgentName }) =>
      `${playerAgentName}. I sell to everyone , but don't expect a friendly discount.`,
  ],
};

function pickLine(
  lines: DialoguePick[],
  ctx: { playerAgentName: string }
): string {
  const line = lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
  return line(ctx);
}

export function getShopkeeperDialogue(
  keeperName: string,
  playerAgentName: string
): ShopkeeperDialogue {
  const relationship = getRelationship(playerAgentName, keeperName);
  const keeperLines =
    KEEPER_LINES[keeperName]?.[relationship] ??
    KEEPER_LINES[keeperName]?.neutral;
  const fallbackLines = GENERIC_LINES[relationship] ?? GENERIC_LINES.neutral;
  const lines = keeperLines ?? fallbackLines;

  return {
    speaker: keeperName,
    text: pickLine(lines, { playerAgentName }),
    accent: KEEPER_ACCENT[keeperName] ?? "emerald",
  };
}

/** Per shopkeeper NPC layout , models differ in width/pose, so tune each one. */
export type ShopkeeperPosition = {
  /** % of image width, negative = left */
  shiftXPercent: number;
  /** Extra pixel nudge, positive = right */
  shiftXPx?: number;
  shiftYPercent?: number;
};

export const SHOPKEEPER_POSITION: Record<string, ShopkeeperPosition> = {
  Raze: { shiftXPercent: -50 },
  Brimstone: { shiftXPercent: -58, shiftXPx: 110 },
  Viper: { shiftXPercent: -36, shiftXPx: -100 },
  Killjoy: { shiftXPercent: -56, shiftXPx: 55 },
  Chamber: { shiftXPercent: -65, shiftXPx: 125 },
  Cypher: { shiftXPercent: -68, shiftXPx: 205 },
};

const DEFAULT_SHOPKEEPER_POSITION: ShopkeeperPosition = {
  shiftXPercent: -68,
  shiftXPx: 0,
  shiftYPercent: 0,
};

export function getShopkeeperPosition(keeperName: string): ShopkeeperPosition {
  return SHOPKEEPER_POSITION[keeperName] ?? DEFAULT_SHOPKEEPER_POSITION;
}
