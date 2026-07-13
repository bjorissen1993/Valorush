import type { Agent } from "../../types/Agent";
import { randomPortraitPath } from "../../game/assetPaths";

export const MAX_LOBBY_SLOTS = 4;

type TwitchPlayerFields = {
  name?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
  avatar?: string;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function isTwitchPlayer(player: TwitchPlayerFields): boolean {
  if (player.twitchLogin) {
    if (!player.name?.trim()) return true;

    const name = normalizeName(player.name);
    const login = normalizeName(player.twitchLogin);
    const imported = normalizeName(player.twitchImportedName ?? player.twitchLogin);

    return name === login || name === imported;
  }

  if (!player.avatar || !player.name?.trim()) return false;

  const url = player.avatar.toLowerCase();
  return (
    url.includes("twitch") ||
    url.includes("jtvnw.net") ||
    url.includes("unavatar.io/twitch")
  );
}

function isValidSlotIndex(slotIndex: unknown, maxSlots: number): slotIndex is number {
  return (
    typeof slotIndex === "number" &&
    Number.isInteger(slotIndex) &&
    slotIndex >= 0 &&
    slotIndex < maxSlots
  );
}

export function buildFixedPlayerSlots<T extends { slotIndex?: number }>(
  players: T[],
  maxSlots = MAX_LOBBY_SLOTS
): (T | null)[] {
  const slots: (T | null)[] = Array.from({ length: maxSlots }, () => null);
  const unassigned: T[] = [];

  for (const player of players) {
    const slotIndex = player.slotIndex;
    if (isValidSlotIndex(slotIndex, maxSlots) && slots[slotIndex] == null) {
      slots[slotIndex] = player;
      continue;
    }
    unassigned.push(player);
  }

  for (const player of unassigned) {
    const emptyIndex = slots.findIndex((slot) => slot == null);
    if (emptyIndex === -1) break;
    slots[emptyIndex] = player;
  }

  return slots;
}

export function findFirstEmptySlotIndex(
  players: { slotIndex: number }[],
  maxSlots = MAX_LOBBY_SLOTS
): number | null {
  const occupied = new Set(players.map((player) => player.slotIndex));

  for (let index = 0; index < maxSlots; index += 1) {
    if (!occupied.has(index)) return index;
  }

  return null;
}

export function isRandomizePending(player: {
  isRandomizePending?: boolean;
  selectedAgentId?: string;
}): boolean {
  return !!player.isRandomizePending && !player.selectedAgentId;
}

/** Profile photo: custom avatar, else roster icon (or random portrait while pending). */
export function resolvePlayerAvatarUrl(
  player: { avatar?: string; isRandomizePending?: boolean },
  agent?: Pick<Agent, "displayIcon"> | null
): string | undefined {
  const customAvatar = player.avatar?.trim();
  if (customAvatar) return customAvatar;

  if (isRandomizePending(player)) {
    return randomPortraitPath();
  }

  if (agent?.displayIcon) return agent.displayIcon;

  return undefined;
}

export function assignRandomUniqueAgents<
  T extends { selectedAgentId?: string; isRandomizePending?: boolean },
>(players: T[], agents: { uuid: string }[]): T[] {
  const takenIds = new Set(
    players
      .map((player) => player.selectedAgentId)
      .filter((id): id is string => !!id)
  );

  const pool = agents.filter((agent) => !takenIds.has(agent.uuid));

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  let poolIndex = 0;

  return players.map((player) => {
    if (!player.isRandomizePending || player.selectedAgentId) {
      return player.isRandomizePending
        ? { ...player, isRandomizePending: false }
        : player;
    }

    const assigned = pool[poolIndex];
    poolIndex += 1;

    return {
      ...player,
      selectedAgentId: assigned?.uuid,
      isRandomizePending: false,
    };
  });
}

function seededUnitRandom(seed: string, index: number): number {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Same inputs + seed → same agent picks on every client (multiplayer). */
export function assignRandomUniqueAgentsSeeded<
  T extends { selectedAgentId?: string; isRandomizePending?: boolean },
>(players: T[], agents: { uuid: string }[], seed: string): T[] {
  const takenIds = new Set(
    players
      .map((player) => player.selectedAgentId)
      .filter((id): id is string => !!id)
  );

  const pool = agents.filter((agent) => !takenIds.has(agent.uuid));

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededUnitRandom(seed, index) * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  let poolIndex = 0;

  return players.map((player, playerIndex) => {
    if (!player.isRandomizePending || player.selectedAgentId) {
      return player.isRandomizePending
        ? { ...player, isRandomizePending: false }
        : player;
    }

    const assigned = pool[poolIndex];
    poolIndex += 1;

    return {
      ...player,
      selectedAgentId: assigned?.uuid,
      isRandomizePending: false,
    };
  });
}
