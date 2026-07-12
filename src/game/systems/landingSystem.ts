import { getNodeById, type TileType } from "../boardLayout";
import type { GameEvent, PlayerInGame } from "../../types/Game";
import { getResolvedEventEffect } from "../eventResolution";
import { getRandomEvent } from "../eventPool";

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
      kind: "duel";
    }
  | {
      kind: "minigame";
    }
  | {
      kind: "normal";
      tileType: TileType;
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

  if (landedNode.type === "duel") {
    return {
      kind: "duel",
    };
  }

  return {
    kind: "normal",
    tileType: landedNode.type,
  };
}

/** Human-readable landing message for tiles without a special phase. */
export function getNormalTileMessage(tileType: TileType): {
  title: string;
  subtitle: string;
} {
  switch (tileType) {
    case "start":
      return {
        title: "Start",
        subtitle: "Spawn tile , no effect.",
      };
    case "merge":
      return {
        title: "Merge",
        subtitle: "Shortcut routes reunite here.",
      };
    case "empty":
      return {
        title: "Empty",
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