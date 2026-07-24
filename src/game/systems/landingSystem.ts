import { getNodeById, type TileType } from "../boardLayout";
import type { GameEvent, PlayerInGame } from "../../types/Game";
import { getResolvedEventEffect } from "../eventResolution";
import { getRandomEvent } from "../eventPool";
import { rollNormalTileCredits } from "../economy";

export { getRandomEvent };

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
      kind: "normal";
      tileType: TileType;
      creditReward?: number;
    };

type ResolveLandingTileArgs = {
  finalNodeId: string;
  eventPool: GameEvent[];
};

export function resolveLandingTile({
  finalNodeId,
  eventPool,
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
    return {
      kind: "shop",
    };
  }

  if (landedNode.type === "spike") {
    return {
      kind: "spike",
    };
  }

  if (landedNode.type === "minigame") {
    return {
      kind: "minigame",
    };
  }

  // start / empty / normal → credit roll on normal (and empty aliases)
  const isCreditTile =
    landedNode.type === "normal" || landedNode.type === "empty";

  return {
    kind: "normal",
    tileType: landedNode.type,
    creditReward: isCreditTile ? rollNormalTileCredits() : 0,
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
    default:
      return {
        title: tileType.charAt(0).toUpperCase() + tileType.slice(1),
        subtitle: "No special effect.",
      };
  }
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
