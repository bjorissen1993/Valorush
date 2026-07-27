import { getNodeById, type TileType } from "../boardLayout";
import type { GameEvent, PlayerInGame } from "../../types/Game";
import { getResolvedEventEffect } from "../eventResolution";
import { getRandomEvent } from "../eventPool";
import {
  pickLuckyFreeItemId,
  RISK_JACKPOT_PAYMENT,
  rollNormalTileCredits,
  rollRiskCreditLoss,
} from "../economy";

export { getRandomEvent };

export type LuckyChoiceId =
  | "credits"
  | "ult-orb"
  | "free-item"
  | "agent-dice"
  | "buff";

export type RiskOutcomeKind =
  | "lose-credits"
  | "movement-penalty"
  | "lose-orb"
  | "pay-jackpot"
  | "minor-negative";

export type LandingResolution =
  | {
      kind: "event";
      event: GameEvent;
    }
  | {
      kind: "shop";
    }
  | {
      kind: "spike";
    }
  | {
      kind: "minigame";
    }
  | {
      kind: "lucky";
    }
  | {
      kind: "ult-orb";
    }
  | {
      kind: "risk";
      outcome: RiskOutcomeKind;
      creditLoss?: number;
      jackpotPayment?: number;
    }
  | {
      kind: "special";
    }
  | {
      kind: "normal";
      tileType: TileType;
      creditReward?: number;
    };

type ResolveLandingTileArgs = {
  finalNodeId: string;
  eventPool: GameEvent[];
  random?: () => number;
};

const RISK_OUTCOMES: ReadonlyArray<{
  kind: RiskOutcomeKind;
  weight: number;
}> = [
  { kind: "lose-credits", weight: 35 },
  { kind: "movement-penalty", weight: 25 },
  { kind: "lose-orb", weight: 15 },
  { kind: "pay-jackpot", weight: 15 },
  { kind: "minor-negative", weight: 10 },
];

export function rollRiskOutcome(
  random: () => number = Math.random
): RiskOutcomeKind {
  const total = RISK_OUTCOMES.reduce((sum, row) => sum + row.weight, 0);
  let roll = random() * total;
  for (const row of RISK_OUTCOMES) {
    roll -= row.weight;
    if (roll <= 0) return row.kind;
  }
  return "lose-credits";
}

export function resolveLandingTile({
  finalNodeId,
  eventPool,
  random = Math.random,
}: ResolveLandingTileArgs): LandingResolution {
  const landedNode = getNodeById(finalNodeId);

  if (!landedNode) {
    return {
      kind: "normal",
      tileType: "empty",
      creditReward: 0,
    };
  }

  if (landedNode.type === "event") {
    return {
      kind: "event",
      event: getRandomEvent(eventPool),
    };
  }

  if (landedNode.type === "shop") {
    return { kind: "shop" };
  }

  if (landedNode.type === "spike") {
    return { kind: "spike" };
  }

  if (landedNode.type === "minigame") {
    return { kind: "minigame" };
  }

  if (landedNode.type === "lucky") {
    return { kind: "lucky" };
  }

  if (landedNode.type === "ult-orb") {
    return { kind: "ult-orb" };
  }

  if (landedNode.type === "special") {
    return { kind: "special" };
  }

  if (landedNode.type === "risk") {
    const outcome = rollRiskOutcome(random);
    if (outcome === "lose-credits") {
      return {
        kind: "risk",
        outcome,
        creditLoss: rollRiskCreditLoss(random),
      };
    }
    if (outcome === "pay-jackpot") {
      return {
        kind: "risk",
        outcome,
        jackpotPayment: RISK_JACKPOT_PAYMENT,
      };
    }
    return { kind: "risk", outcome };
  }

  // start / empty / normal → credit roll on normal (and empty aliases)
  const isCreditTile =
    landedNode.type === "normal" || landedNode.type === "empty";

  return {
    kind: "normal",
    tileType: landedNode.type,
    creditReward: isCreditTile ? rollNormalTileCredits(random) : 0,
  };
}

/** Human-readable landing message for tiles without a special phase. */
export function getNormalTileMessage(
  tileType: TileType,
  creditReward?: number
): {
  title: string;
  subtitle: string;
} {
  switch (tileType) {
    case "start":
      return {
        title: "Start",
        subtitle: "Spawn tile — no effect.",
      };
    case "normal":
    case "empty":
      if (creditReward && creditReward > 0) {
        return {
          title: "Credits",
          subtitle: `Collected +${creditReward} creds.`,
        };
      }
      return {
        title: "Normal",
        subtitle: "Nothing happens on this tile.",
      };
    case "ult-orb":
      return {
        title: "Ultimate Orb",
        subtitle: "Gained +1 ultimate orb.",
      };
    case "special":
      return {
        title: "Tactical",
        subtitle: "+1 movement on your next roll.",
      };
    case "lucky":
      return {
        title: "Lucky",
        subtitle: "Choose your reward.",
      };
    case "risk":
      return {
        title: "Risk",
        subtitle: "A mild setback hit.",
      };
    default:
      return {
        title: tileType.charAt(0).toUpperCase() + tileType.slice(1),
        subtitle: "No special effect.",
      };
  }
}

export const LUCKY_CHOICE_OPTIONS: ReadonlyArray<{
  id: LuckyChoiceId;
  label: string;
  description: string;
}> = [
  {
    id: "credits",
    label: "Credits",
    description: "+500 creds",
  },
  {
    id: "ult-orb",
    label: "Ult Orb",
    description: "+1 ultimate orb",
  },
  {
    id: "free-item",
    label: "Free Item",
    description: "A random shop item",
  },
  {
    id: "agent-dice",
    label: "Agent Dice",
    description: "Gain Agent Dice",
  },
  {
    id: "buff",
    label: "Buff",
    description: "+1 movement next roll",
  },
];

export function resolveLuckyFreeItemId(
  random: () => number = Math.random
): string {
  return pickLuckyFreeItemId(random);
}

export function applyEventEffect(
  player: PlayerInGame,
  event: GameEvent
): PlayerInGame {
  const effect = getResolvedEventEffect(event);
  if (!effect) return player;

  switch (effect.type) {
    case "creds":
      return {
        ...player,
        creds: Math.max(0, player.creds + effect.amount),
      };

    case "radianite":
      return {
        ...player,
        radianitePoints: Math.max(
          0,
          player.radianitePoints + effect.amount
        ),
      };

    case "discount":
      return {
        ...player,
        nextWeaponDiscount: player.nextWeaponDiscount + effect.amount,
      };

    default:
      return player;
  }
}
