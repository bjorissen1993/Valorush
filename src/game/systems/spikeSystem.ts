import { boardLayout } from "../boardLayout";
import type { Agent } from "../../types/Agent";
import type { PlayerInGame } from "../../types/Game";
import {
  buildSpikePlantStory,
  buildSoloSpikeStory,
  resolveSpikeHelper,
} from "../narrativeSystem";
import { agentBackgroundPath, resolveAgentStoryArt } from "../assetPaths";

export type SpikeStatus =
  | "planted"
  | "half-defused"
  | "defused"
  | "detonated";

export type DefuseEligibility = "pass-over" | "exact-land" | "not-allowed";

export type ActiveSpike = {
  plantedByPlayerIndex: number;
  plantedOnNodeId: string;

  // timing
  plantedRound: number;
  plantedTurnCycle: number;

  // flavor / modal
  planterAgentName: string;
  planterAgentImage?: string | null;
  planterAgentId?: string | null;

  // gameplay
  status: SpikeStatus;
  defuseProgress: 0 | 1;
  rewarded: boolean;

  // only the first player after planting may try while passing over
  firstPassOpportunityPlayerIndex: number | null;
  firstPassOpportunityUsed: boolean;
};

export type SpikePlantReveal = {
  planterAgentName: string;
  planterAgentImage?: string | null;
  plantedOnNodeId: string;
  headline: string;
  paragraphs: string[];
  dialogues: { speaker: string; text: string }[];
  triggerPlayerName: string;
  triggerAgentName: string;
  allyPlayerName?: string;
  backgroundImage?: string;
  isSoloPlant: boolean;
};

export type SpikeDefuseRollOutcome =
  | {
      kind: "fail";
      roll: number;
      canStay: true;
    }
  | {
      kind: "half";
      roll: number;
      defuseProgress: 1;
      nextRequiredMinRoll: 4;
    }
  | {
      kind: "defused";
      roll: number;
    };

export function getSpikeCandidateNodeIds(): string[] {
  return boardLayout
    .filter((node) => {
      // start nooit
      if (node.type === "start") return false;

      // merge/split liever niet als spike locatie
      if (node.type === "merge" || node.type === "split") return false;

      return true;
    })
    .map((node) => node.id);
}

export function pickRandomSpikeNodeId(excludedNodeIds: string[] = []): string {
  const candidates = getSpikeCandidateNodeIds().filter(
    (nodeId) => !excludedNodeIds.includes(nodeId)
  );

  if (candidates.length === 0) {
    throw new Error("No valid spike node candidates found.");
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getNonActivePlanterAgent(
  activeAgentIds: string[],
  allAgents: Agent[],
  preferredAgentIds: string[] = []
) {
  const availableAgents = allAgents.filter(
    (agent) => !activeAgentIds.includes(agent.uuid)
  );

  const preferredAvailable = preferredAgentIds
    .map((id) => availableAgents.find((agent) => agent.uuid === id))
    .filter(Boolean) as Agent[];

  const pool = preferredAvailable.length > 0 ? preferredAvailable : availableAgents;

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

type CreateSpikeArgs = {
  plantedByPlayerIndex: number;
  plantedRound: number;
  plantedTurnCycle: number;
  firstPassOpportunityPlayerIndex: number | null;
  activeAgentIds: string[];
  allAgents: Agent[];
  excludedNodeIds?: string[];
  triggerPlayerName: string;
  triggerAgentName: string;
  playersInGame: PlayerInGame[];
};

export function createActiveSpike({
  plantedByPlayerIndex,
  plantedRound,
  plantedTurnCycle,
  firstPassOpportunityPlayerIndex,
  activeAgentIds,
  allAgents,
  excludedNodeIds = [],
  triggerPlayerName,
  triggerAgentName,
  playersInGame,
}: CreateSpikeArgs): {
  spike: ActiveSpike;
  reveal: SpikePlantReveal;
} {
  const plantedOnNodeId = pickRandomSpikeNodeId(excludedNodeIds);

  const triggerAgent = allAgents.find(
    (a) =>
      a.displayName.toLowerCase() === triggerAgentName.toLowerCase()
  );

  const helper = resolveSpikeHelper({
    triggerAgentName,
    triggerPlayerIndex: plantedByPlayerIndex,
    playersInGame,
    agents: allAgents,
    activeAgentIds,
  });

  let story: {
    headline: string;
    paragraphs: string[];
    dialogues: { speaker: string; text: string }[];
  };
  let displayAgent: Agent | null;
  let isSoloPlant = false;

  if (helper) {
    displayAgent = helper.agent;
    story = buildSpikePlantStory({
      triggerPlayerName,
      triggerAgentName,
      ally: helper,
      plantedOnNodeId,
    });
  } else {
    isSoloPlant = true;
    displayAgent = triggerAgent ?? null;
    story = buildSoloSpikeStory({
      triggerPlayerName,
      triggerAgentName,
      plantedOnNodeId,
    });
  }

  const planterAgentName =
    displayAgent?.displayName ?? triggerAgentName;
  const planterAgentImage = displayAgent
    ? resolveAgentStoryArt(displayAgent.displayName).src
    : null;

  const spike: ActiveSpike = {
    plantedByPlayerIndex,
    plantedOnNodeId,
    plantedRound,
    plantedTurnCycle,
    planterAgentName,
    planterAgentImage,
    planterAgentId: displayAgent?.uuid ?? null,
    status: "planted",
    defuseProgress: 0,
    rewarded: false,
    firstPassOpportunityPlayerIndex,
    firstPassOpportunityUsed: false,
  };

  return {
    spike,
    reveal: {
      planterAgentName,
      planterAgentImage,
      plantedOnNodeId,
      headline: story.headline,
      paragraphs: story.paragraphs,
      dialogues: story.dialogues,
      triggerPlayerName,
      triggerAgentName,
      allyPlayerName: helper?.playerName,
      backgroundImage: agentBackgroundPath(
        isSoloPlant ? triggerAgentName : helper!.agentName
      ),
      isSoloPlant,
    },
  };
}

type SpikeDetonationCheckArgs = {
  spike: ActiveSpike | null;
  currentRound: number;
  currentPlayerIndex: number;
};

export function shouldSpikeDetonate({
  spike,
  currentRound,
  currentPlayerIndex,
}: SpikeDetonationCheckArgs): boolean {
  if (!spike) return false;
  if (spike.status !== "planted" && spike.status !== "half-defused") return false;

  const twoFullRotationsPassed = currentRound >= spike.plantedRound + 2;
  const planterTurn = currentPlayerIndex === spike.plantedByPlayerIndex;

  return twoFullRotationsPassed && planterTurn;
}

export function getDefuseEligibility(args: {
  spike: ActiveSpike | null;
  playerIndex: number;
  landedExactly: boolean;
}): DefuseEligibility {
  const { spike, playerIndex, landedExactly } = args;

  if (!spike) return "not-allowed";
  if (spike.status === "defused" || spike.status === "detonated") {
    return "not-allowed";
  }

  if (
    spike.firstPassOpportunityPlayerIndex === playerIndex &&
    !spike.firstPassOpportunityUsed
  ) {
    return "pass-over";
  }

  if (landedExactly) {
    return "exact-land";
  }

  return "not-allowed";
}

export function markFirstPassOpportunityUsed(spike: ActiveSpike): ActiveSpike {
  return {
    ...spike,
    firstPassOpportunityUsed: true,
  };
}

export function resolveSpikeDefuseRoll(
  roll: number,
  currentProgress: 0 | 1
): SpikeDefuseRollOutcome {
  if (currentProgress === 0) {
    if (roll >= 1 && roll <= 3) {
      return {
        kind: "fail",
        roll,
        canStay: true,
      };
    }

    return {
      kind: "half",
      roll,
      defuseProgress: 1,
      nextRequiredMinRoll: 4,
    };
  }

  if (roll >= 4) {
    return {
      kind: "defused",
      roll,
    };
  }

  return {
    kind: "fail",
    roll,
    canStay: true,
  };
}

export function applySpikeDefuseOutcome(
  spike: ActiveSpike,
  outcome: SpikeDefuseRollOutcome
): ActiveSpike {
  if (outcome.kind === "half") {
    return {
      ...spike,
      status: "half-defused",
      defuseProgress: 1,
    };
  }

  if (outcome.kind === "defused") {
    return {
      ...spike,
      status: "defused",
      defuseProgress: 1,
    };
  }

  return spike;
}

export function markSpikeDetonated(spike: ActiveSpike): ActiveSpike {
  return {
    ...spike,
    status: "detonated",
  };
}

export function shouldRewardPlanter(spike: ActiveSpike | null): boolean {
  return !!spike && spike.status === "detonated" && !spike.rewarded;
}

export function shouldRewardDefuser(spike: ActiveSpike | null): boolean {
  return !!spike && spike.status === "defused" && !spike.rewarded;
}

export function markSpikeRewarded(spike: ActiveSpike): ActiveSpike {
  return {
    ...spike,
    rewarded: true,
  };
}