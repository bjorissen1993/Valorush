import type React from "react";
import { getNodeById } from "../boardLayout";

export const MOVE_STEP_DELAY = 120;
export const JUMP_DURATION = 280;

export type AnimatedTokenState = {
  playerIndex: number;
  x: number;
  y: number;
  jumpOffset: number;
} | null;

export type SetAnimatedToken = React.Dispatch<
  React.SetStateAction<AnimatedTokenState>
>;

export type UpdatePlayerPosition = (
  playerIndex: number,
  newPosition: string
) => void;

export type MovementResult = {
  blockedBySplit: boolean;
  finalNodeId: string;
  remainingSteps?: number;
  splitOptions?: string[];
  stoppedBySpikeDefuse?: boolean;
};

type TraverseOptions = {
  playerIndex: number;
  startNodeId: string;
  steps: number;
  setAnimatedToken: SetAnimatedToken;
  updatePlayerPosition: UpdatePlayerPosition;
  onPassOverSpike?: (
    nodeId: string,
    playerIndex: number
  ) => boolean | Promise<boolean>;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function getNodeCoords(nodeId: string) {
  const node = getNodeById(nodeId);
  if (!node) return null;

  return {
    x: node.x,
    y: node.y,
  };
}

export async function animateJump(
  playerIndex: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  setAnimatedToken: SetAnimatedToken,
  duration = JUMP_DURATION
) {
  return new Promise<void>((resolve) => {
    const startTime = performance.now();

    function frame(now: number) {
      const rawProgress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(rawProgress);

      const x = lerp(fromX, toX, eased);
      const y = lerp(fromY, toY, eased);
      const jumpOffset = Math.sin(rawProgress * Math.PI) * 26;

      setAnimatedToken({
        playerIndex,
        x,
        y,
        jumpOffset,
      });

      if (rawProgress < 1) {
        requestAnimationFrame(frame);
      } else {
        setAnimatedToken({
          playerIndex,
          x: toX,
          y: toY,
          jumpOffset: 0,
        });
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

export async function traverseMovement({
  playerIndex,
  startNodeId,
  steps,
  setAnimatedToken,
  updatePlayerPosition,
  onPassOverSpike,
}: TraverseOptions): Promise<MovementResult> {
  let currentNodeId = startNodeId;
  let remainingSteps = steps;

  while (remainingSteps > 0) {
    const node = getNodeById(currentNodeId);
    if (!node || node.next.length === 0) break;

    // stop bij split zodat GamePage de keuze kan tonen
    if (node.type === "split" && node.next.length > 1) {
      return {
        blockedBySplit: true,
        finalNodeId: currentNodeId,
        remainingSteps,
        splitOptions: node.next,
      };
    }

    const nextNodeId = node.next[0];
    const fromCoords = getNodeCoords(currentNodeId);
    const toCoords = getNodeCoords(nextNodeId);

    if (fromCoords && toCoords) {
      await animateJump(
        playerIndex,
        fromCoords.x,
        fromCoords.y,
        toCoords.x,
        toCoords.y,
        setAnimatedToken
      );
    }

    updatePlayerPosition(playerIndex, nextNodeId);

    if (onPassOverSpike) {
      const shouldStop = await onPassOverSpike(nextNodeId, playerIndex);

      if (shouldStop) {
        return {
          blockedBySplit: false,
          finalNodeId: nextNodeId,
          stoppedBySpikeDefuse: true,
        };
      }
    }

    currentNodeId = nextNodeId;
    remainingSteps -= 1;

    await sleep(MOVE_STEP_DELAY);
  }

  return {
    blockedBySplit: false,
    finalNodeId: currentNodeId,
    stoppedBySpikeDefuse: false,
  };
}