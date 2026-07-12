import { useEffect, useRef, useState } from "react";
import type { Agent } from "../types/Agent";
import type { PlayerInGame } from "../types/Game";
import {
  agentBackgroundPath,
  agentPortraitPath,
  randomBackgroundPath,
  randomPortraitPath,
} from "../game/assetPaths";
import {
  buildTurnOrderDiceSequence,
  getPlaceLabel,
  getRollForPlayer,
  type TurnOrderDiceSequence,
  type TurnOrderStep,
} from "../game/systems/turnOrderDiceSystem";
import {
  MAX_LOBBY_SLOTS,
  buildFixedPlayerSlots,
  isRandomizePending,
} from "./lobby/lobbyPlayerUtils";
import DiceFace, { DICE_REVEAL_BLINK_MS } from "./DiceFace";

type Props = {
  players: PlayerInGame[];
  agents: Agent[];
  getAgentName: (player: PlayerInGame) => string;
  rollDurationMs?: number;
  resultHoldMs?: number;
  onComplete: (order: number[]) => void;
};

const TITLE_DURATION_MS = 2400;
const COLUMN_FALL_MS = 820;
const COLUMN_STAGGER_MS = 210;
const ANNOUNCE_MS = 1400;
const REVEAL_MS = 750;
const DICE_BOUNCE_MS = 450;

type IntroPhase = "title" | "columns" | "gameplay";
type PlayerRollPhase = "idle" | "rolling" | "revealing" | "result" | "done";

function getPlayerIndexForSlot(
  players: PlayerInGame[],
  slotIndex: number
): number | null {
  const index = players.findIndex((player) => player.slotIndex === slotIndex);
  return index >= 0 ? index : null;
}

function getColumnPlacementStyle(
  place: number | undefined,
  isInActiveRound: boolean,
  hasPlayer: boolean
) {
  if (!hasPlayer) {
    return "border-dashed border-white/5 bg-zinc-950/40";
  }
  if (isInActiveRound) {
    return "border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_32px_rgba(34,211,238,0.18)]";
  }
  switch (place) {
    case 1:
      return "border-[#3fbcc1]/55 bg-[#2e8b91]/14 shadow-[0_0_28px_rgba(63,188,193,0.28)]";
    case 2:
      return "border-amber-400/50 bg-amber-400/12 shadow-[0_0_28px_rgba(251,191,36,0.15)]";
    case 3:
      return "border-zinc-300/45 bg-zinc-300/10 shadow-[0_0_24px_rgba(212,212,216,0.14)]";
    case 4:
      return "border-orange-700/45 bg-orange-900/12 shadow-[0_0_24px_rgba(194,65,12,0.14)]";
    default:
      return "border-white/10 bg-zinc-900/70 shadow-2xl";
  }
}

function getPlaceHeaderStyle(place: number) {
  switch (place) {
    case 1:
      return "bg-gradient-to-r from-[#54cbd0] via-[#3fbcc1] to-[#2e8b91] text-[#0d2a2c]";
    case 2:
      return "bg-gradient-to-r from-amber-300 to-yellow-500 text-black";
    case 3:
      return "bg-gradient-to-r from-zinc-300 to-zinc-500 text-black";
    default:
      return "bg-gradient-to-r from-amber-700 to-orange-800 text-amber-50";
  }
}

function getStepSubtitle(
  step: TurnOrderStep,
  introPhase: IntroPhase,
  columnsReady: boolean
): string | null {
  if (introPhase !== "gameplay" || !columnsReady) return null;
  if (step.kind === "announce") return step.message;
  if (step.kind === "ready") return "Turn order locked in";
  if (step.kind === "reveal") return `${getPlaceLabel(step.place)} place`;
  if (step.isTiebreak) return "Tied players — re-roll together";
  return "Everyone roll at once";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export default function TurnOrderScreen({
  players,
  agents,
  getAgentName: _getAgentName,
  rollDurationMs = 1400,
  resultHoldMs = 900,
  onComplete,
}: Props) {
  const [sequence, setSequence] = useState<TurnOrderDiceSequence>(() =>
    buildTurnOrderDiceSequence(players.length)
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("title");
  const [titlePlaying, setTitlePlaying] = useState(false);
  const [columnsReady, setColumnsReady] = useState(false);
  const [playerRollPhases, setPlayerRollPhases] = useState<
    Record<number, PlayerRollPhase>
  >({});
  const [bouncingPlayerIndex, setBouncingPlayerIndex] = useState<number | null>(
    null
  );
  const [revealedRolls, setRevealedRolls] = useState<Record<number, number>>(
    {}
  );
  const [placements, setPlacements] = useState<
    { playerIndex: number; place: number; roll: number }[]
  >([]);
  const [showBeginButton, setShowBeginButton] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const slots = buildFixedPlayerSlots(players, MAX_LOBBY_SLOTS);

  useEffect(() => {
    setSequence(buildTurnOrderDiceSequence(players.length));
    setStepIndex(0);
    setIntroPhase("title");
    setTitlePlaying(false);
    setColumnsReady(false);
    setPlayerRollPhases({});
    setBouncingPlayerIndex(null);
    setRevealedRolls({});
    setPlacements([]);
    setShowBeginButton(false);
  }, [players.length]);

  useEffect(() => {
    if (introPhase !== "title") return;

    let cancelled = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setTitlePlaying(true);
      });
    });

    const timer = window.setTimeout(() => {
      setIntroPhase("columns");
    }, TITLE_DURATION_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "columns") return;

    const totalMs =
      (MAX_LOBBY_SLOTS - 1) * COLUMN_STAGGER_MS + COLUMN_FALL_MS + 80;

    const timer = window.setTimeout(() => {
      setColumnsReady(true);
      setIntroPhase("gameplay");
    }, totalMs);

    return () => window.clearTimeout(timer);
  }, [introPhase]);

  const currentStep = sequence?.steps[stepIndex] ?? null;
  const isReady = currentStep?.kind === "ready";
  const isRollRound = currentStep?.kind === "roll-round";
  const activeRoundPlayerIndices = isRollRound
    ? currentStep.players.map((entry) => entry.playerIndex)
    : [];

  useEffect(() => {
    if (currentStep?.kind !== "roll-round") return;

    setPlayerRollPhases((current) => {
      const next = { ...current };
      for (const { playerIndex } of currentStep.players) {
        next[playerIndex] = "idle";
      }
      return next;
    });
  }, [stepIndex, currentStep]);

  useEffect(() => {
    if (!sequence || !currentStep || isReady) return;

    if (currentStep.kind === "roll-round") return;

    if (currentStep.kind === "announce") {
      const timer = window.setTimeout(() => {
        setStepIndex((index) => index + 1);
      }, ANNOUNCE_MS);
      return () => window.clearTimeout(timer);
    }

    if (currentStep.kind === "reveal") {
      setPlacements((current) => {
        if (current.some((entry) => entry.place === currentStep.place)) {
          return current;
        }
        return [
          ...current,
          {
            playerIndex: currentStep.playerIndex,
            place: currentStep.place,
            roll: currentStep.roll,
          },
        ];
      });

      const timer = window.setTimeout(() => {
        setStepIndex((index) => index + 1);
      }, REVEAL_MS);
      return () => window.clearTimeout(timer);
    }
  }, [sequence, currentStep, isReady, stepIndex]);

  useEffect(() => {
    if (!isRollRound || !columnsReady) return;

    const allFinished = activeRoundPlayerIndices.every((playerIndex) => {
      const phase = playerRollPhases[playerIndex];
      return phase === "result" || phase === "done";
    });

    if (!allFinished) return;

    const timer = window.setTimeout(() => {
      setPlayerRollPhases((current) => {
        const next = { ...current };
        for (const playerIndex of activeRoundPlayerIndices) {
          next[playerIndex] = "done";
        }
        return next;
      });
      setStepIndex((index) => index + 1);
    }, resultHoldMs);

    return () => window.clearTimeout(timer);
  }, [
    isRollRound,
    columnsReady,
    activeRoundPlayerIndices,
    playerRollPhases,
    resultHoldMs,
  ]);

  useEffect(() => {
    if (!isReady) {
      setShowBeginButton(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowBeginButton(true);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isReady]);

  async function handlePlayerRoll(playerIndex: number) {
    if (introPhase !== "gameplay" || !columnsReady) return;
    if (!currentStep || currentStep.kind !== "roll-round") return;
    if (playerRollPhases[playerIndex] !== "idle") return;

    const roll = getRollForPlayer(currentStep, playerIndex);
    if (roll == null) return;

    setBouncingPlayerIndex(playerIndex);

    await delay(DICE_BOUNCE_MS);
    setBouncingPlayerIndex(null);

    setPlayerRollPhases((current) => ({
      ...current,
      [playerIndex]: "rolling",
    }));

    await delay(rollDurationMs);

    setPlayerRollPhases((current) => ({
      ...current,
      [playerIndex]: "revealing",
    }));

    await delay(DICE_REVEAL_BLINK_MS);

    setRevealedRolls((current) => ({
      ...current,
      [playerIndex]: roll,
    }));

    setPlayerRollPhases((current) => ({
      ...current,
      [playerIndex]: "result",
    }));
  }

  const subtitle = currentStep
    ? getStepSubtitle(currentStep, introPhase, columnsReady)
    : null;
  const rollingEnabled =
    introPhase === "gameplay" && columnsReady && isRollRound;

  function getAgent(player: PlayerInGame | null) {
    if (!player?.selectedAgentId) return undefined;
    return agents.find((agent) => agent.uuid === player.selectedAgentId);
  }

  function getPortrait(player: PlayerInGame | null, agent?: Agent) {
    if (!player) return null;
    if (isRandomizePending(player)) return randomPortraitPath();
    if (agent?.fullPortrait) return agent.fullPortrait;
    if (agent?.displayName) return agentPortraitPath(agent.displayName);
    if (agent?.displayIcon) return agent.displayIcon;
    return null;
  }

  function getBackgroundPath(player: PlayerInGame | null, agent?: Agent) {
    if (!player) return null;
    if (isRandomizePending(player)) return randomBackgroundPath();
    if (agent?.displayName) return agentBackgroundPath(agent.displayName);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#070b14] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#070b14]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,70,85,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(15,25,35,0.9),_transparent_60%)]" />

      {introPhase === "title" && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <div
            className={[
              "turn-order-title-banner absolute left-1/2 top-1/2 w-[1200px] max-w-[96vw] -translate-x-1/2 text-center",
              titlePlaying ? "turn-order-title-banner--active" : "",
            ].join(" ")}
          >
            <h1 className="text-4xl font-black uppercase tracking-[0.12em] text-white drop-shadow-[0_8px_32px_rgba(0,0,0,0.65)] sm:text-6xl">
              Who&apos;s going first?
            </h1>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        <div
          className={`mb-6 text-center transition-opacity duration-500 ${
            introPhase === "title" ? "opacity-0" : "opacity-100"
          }`}
        >
          <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
            Who&apos;s going first?
          </h1>
          {subtitle && (
            <p
              className={`mt-3 text-sm font-semibold sm:text-base ${
                currentStep?.kind === "announce"
                  ? "text-amber-300"
                  : "text-zinc-400"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {slots.map((player, slotIndex) => {
            const playerIndex = getPlayerIndexForSlot(players, slotIndex);
            const agent = getAgent(player);
            const portrait = getPortrait(player, agent);
            const backgroundPath = getBackgroundPath(player, agent);
            const isInActiveRound =
              playerIndex != null &&
              rollingEnabled &&
              activeRoundPlayerIndices.includes(playerIndex);
            const placement =
              playerIndex != null
                ? placements.find((entry) => entry.playerIndex === playerIndex)
                : undefined;
            const roll =
              playerIndex != null ? revealedRolls[playerIndex] : undefined;
            const rollPhase =
              playerIndex != null ? playerRollPhases[playerIndex] : undefined;
            const showDice =
              player != null &&
              ((isInActiveRound && rollPhase != null) || roll != null);
            const canRoll =
              isInActiveRound && rollPhase === "idle" && rollingEnabled;
            const pendingRoll =
              isInActiveRound &&
              currentStep?.kind === "roll-round" &&
              playerIndex != null
                ? getRollForPlayer(currentStep, playerIndex)
                : undefined;
            const diceValue = roll ?? pendingRoll ?? 1;
            const diceRolling = rollPhase === "rolling";
            const diceRevealing = rollPhase === "revealing";
            const diceIdle = rollPhase === "idle";
            const showDiceResult =
              roll != null &&
              (rollPhase === "result" ||
                rollPhase === "done" ||
                !isInActiveRound);
            const isBouncing = playerIndex === bouncingPlayerIndex;
            const columnPhaseClass =
              introPhase === "columns"
                ? "turn-order-column--fall"
                : introPhase === "gameplay"
                  ? "turn-order-column--landed"
                  : "turn-order-column--hidden";

            return (
              <div
                key={player?.id ?? `empty-${slotIndex}`}
                style={
                  introPhase === "columns"
                    ? { animationDelay: `${slotIndex * COLUMN_STAGGER_MS}ms` }
                    : undefined
                }
                className={[
                  "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border transition-all duration-500 sm:rounded-3xl",
                  getColumnPlacementStyle(
                    placement?.place,
                    isInActiveRound,
                    player != null
                  ),
                  columnPhaseClass,
                ].join(" ")}
              >
                {placement && (
                  <div
                    className={`turn-order-place-header absolute inset-x-0 top-0 z-20 flex items-center justify-center py-2.5 text-sm font-black uppercase tracking-[0.2em] sm:text-base ${getPlaceHeaderStyle(
                      placement.place
                    )}`}
                  >
                    {getPlaceLabel(placement.place as 1 | 2 | 3 | 4)}
                  </div>
                )}

                {player && portrait ? (
                  <>
                    <div className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden pb-[148px] sm:pb-[168px]">
                      <div className="relative min-h-0 flex-1 overflow-hidden">
                        {backgroundPath && (
                          <div className="agent-bg-text-layer z-0">
                            <img
                              src={backgroundPath}
                              alt=""
                              aria-hidden
                              className="agent-bg-text-img opacity-20"
                            />
                          </div>
                        )}
                        <img
                          src={portrait}
                          alt={agent?.displayName ?? "Agent"}
                          className={`absolute left-1/2 top-0 z-[1] h-[118%] w-auto max-w-none -translate-x-1/2 object-contain object-top brightness-110 contrast-110 drop-shadow-[0_24px_48px_rgba(0,0,0,0.85)] transition-opacity duration-300 ${
                            isInActiveRound
                              ? "opacity-100"
                              : placement
                                ? "opacity-95"
                                : roll != null
                                  ? "opacity-80"
                                  : "opacity-55"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
                    Empty slot
                  </div>
                )}

                {player && (
                  <div className="relative z-10 mt-auto flex flex-col items-center px-4 py-5 sm:px-5 sm:py-6">
                    {showDice && (
                      <button
                        type="button"
                        onClick={() =>
                          playerIndex != null &&
                          void handlePlayerRoll(playerIndex)
                        }
                        disabled={!canRoll}
                        className={`flex flex-col items-center transition ${
                          canRoll
                            ? "cursor-pointer hover:brightness-110"
                            : "cursor-default"
                        }`}
                        aria-label={
                          canRoll
                            ? `Roll dice for ${player.name}`
                            : `${player.name} dice`
                        }
                      >
                        <div className="relative flex min-h-[7.5rem] flex-col items-center justify-end pt-7">
                          <div
                            className={[
                              "dice-roll-stage flex flex-col items-center",
                              diceRolling || diceRevealing
                                ? "dice-roll-stage--rolling"
                                : showDiceResult
                                  ? "dice-roll-stage--landed"
                                  : "",
                              isBouncing ? "dice-roll-stage--bounce" : "",
                            ].join(" ")}
                          >
                            <DiceFace
                              value={diceValue}
                              rolling={diceRolling}
                              revealing={diceRevealing}
                              idle={diceIdle}
                              size="sm"
                              showValue={showDiceResult}
                              valuePosition="above"
                              rollDurationMs={rollDurationMs}
                            />
                          </div>
                        </div>

                        <p
                          className={`mt-3 min-h-[1.25rem] text-xs font-bold uppercase tracking-[0.2em] sm:text-sm ${
                            canRoll
                              ? "text-cyan-300"
                              : "pointer-events-none text-transparent"
                          }`}
                          aria-hidden={!canRoll}
                        >
                          Click to roll
                        </p>
                      </button>
                    )}

                    {!showDice &&
                      roll == null &&
                      !isInActiveRound &&
                      introPhase === "gameplay" &&
                      columnsReady && (
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Waiting
                        </p>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="turn-order-begin-slot mt-8 flex flex-col items-center justify-end gap-3">
          <div
            className={
              isReady && showBeginButton
                ? "turn-order-begin--animate flex flex-col items-center gap-3"
                : "turn-order-begin--hidden flex flex-col items-center gap-3"
            }
            aria-hidden={!isReady || !showBeginButton}
          >
            <p className="text-sm text-zinc-400">Press to start the match</p>
            <button
              type="button"
              onClick={() => onCompleteRef.current(sequence!.order)}
              disabled={!isReady || !showBeginButton}
              tabIndex={isReady && showBeginButton ? 0 : -1}
              className="w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-400 px-10 py-4 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_32px_rgba(255,70,85,0.35)] transition hover:brightness-110 disabled:pointer-events-none sm:w-auto sm:min-w-[280px]"
            >
              Begin match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
