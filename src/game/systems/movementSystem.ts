import type React from "react";
import {
  DEFAULT_GATE_STATES,
  getNodeById,
  getNodeExits,
  type GateStates,
} from "../boardLayout";

export const MOVE_STEP_DELAY = 120;
export const JUMP_DURATION = 280;
export const TELEPORT_DURATION = 480;
export const TELEPORT_JUMP_HEIGHT = 42;

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
  /** True when the token paused at a branch (next.length > 1). */
  blockedBySplit: boolean;
  finalNodeId: string;
  remainingSteps?: number;
  /** Exit node ids available at the branch. */
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
  /** Return true if the directed edge is blocked (Astra ultimate wall). */
  isEdgeBlocked?: (fromNodeId: string, toNodeId: string) => boolean;
  /** Return true to end movement after entering this node (Vyse trap). */
  onEnterNode?: (
    nodeId: string,
    playerIndex: number
  ) => boolean | Promise<boolean>;
  /** Per-gate open branch states for gated shortcuts. */
  gateStates?: GateStates;
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
  duration = JUMP_DURATION,
  jumpHeight = 26
) {
  return new Promise<void>((resolve) => {
    const startTime = performance.now();

    function frame(now: number) {
      const rawProgress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(rawProgress);

      const x = lerp(fromX, toX, eased);
      const y = lerp(fromY, toY, eased);
      const jumpOffset = Math.sin(rawProgress * Math.PI) * jumpHeight;

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

/** Animate a token from one board node to another (teleport / swap / event move). */
export async function animateTeleport(
  playerIndex: number,
  fromNodeId: string,
  toNodeId: string,
  setAnimatedToken: SetAnimatedToken,
  duration = TELEPORT_DURATION
): Promise<boolean> {
  if (fromNodeId === toNodeId) return false;
  const fromCoords = getNodeCoords(fromNodeId);
  const toCoords = getNodeCoords(toNodeId);
  if (!fromCoords || !toCoords) return false;

  await animateJump(
    playerIndex,
    fromCoords.x,
    fromCoords.y,
    toCoords.x,
    toCoords.y,
    setAnimatedToken,
    duration,
    TELEPORT_JUMP_HEIGHT
  );
  return true;
}

export async function traverseMovement({
  playerIndex,
  startNodeId,
  steps,
  setAnimatedToken,
  updatePlayerPosition,
  onPassOverSpike,
  isEdgeBlocked,
  onEnterNode,
  gateStates = DEFAULT_GATE_STATES,
}: TraverseOptions): Promise<MovementResult> {
  let currentNodeId = startNodeId;
  let remainingSteps = steps;

  while (remainingSteps > 0) {
    const node = getNodeById(currentNodeId);
    const exits = getNodeExits(currentNodeId, gateStates);
    if (!node || exits.length === 0) break;

    // Route choice: any tile with multiple exits pauses mid-movement.
    // Landing effects only run on the final tile (handled by GamePage).
    const openExits = exits.filter(
      (nextId) => !isEdgeBlocked?.(currentNodeId, nextId)
    );

    if (exits.length > 1) {
      if (openExits.length === 0) {
        return {
          blockedBySplit: false,
          finalNodeId: currentNodeId,
          remainingSteps,
        };
      }
      if (openExits.length > 1) {
        return {
          blockedBySplit: true,
          finalNodeId: currentNodeId,
          remainingSteps,
          splitOptions: openExits,
        };
      }
      // Exactly one unblocked exit — auto-take it without prompting.
    }

    const nextNodeId = openExits[0] ?? exits[0]!;
    if (isEdgeBlocked?.(currentNodeId, nextNodeId)) {
      return {
        blockedBySplit: false,
        finalNodeId: currentNodeId,
        remainingSteps,
      };
    }

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

    if (onEnterNode) {
      const trapStop = await onEnterNode(nextNodeId, playerIndex);
      if (trapStop) {
        return {
          blockedBySplit: false,
          finalNodeId: nextNodeId,
        };
      }
    }

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