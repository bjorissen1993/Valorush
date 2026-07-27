import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { boardLayout, getNodeById, listBoardLandmarks } from "../game/boardLayout";

export type BoardCameraMode =
  | "overview"
  | "follow"
  | "event"
  | "board-event";

export type BoardCameraFocus = {
  nodeId: string;
  mode?: BoardCameraMode;
  holdMs?: number;
};

type CameraPose = {
  x: number;
  y: number;
  zoom: number;
};

type Props = {
  children: ReactNode;
  /** Layout-space focus point (player position or landmark). */
  followNodeId: string | null | undefined;
  /** Extra players for cluster zoom (layout positions). */
  playerNodeIds?: string[];
  /** One-shot focus (spike plant, shop discount, area ult). */
  eventFocus?: BoardCameraFocus | null;
  /** Run match-start overview once when true. */
  playIntro?: boolean;
  onIntroComplete?: () => void;
  /** Brief zoom-out for board-wide events. */
  boardEventPulse?: number;
  className?: string;
};

const LERP = 0.12;
const FOLLOW_ZOOM = 1.55;
const CLUSTER_ZOOM = 1.2;
const OVERVIEW_ZOOM = 1;
const EVENT_ZOOM = 1.7;
const BOARD_EVENT_ZOOM = 1.05;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nodePose(nodeId: string | null | undefined): CameraPose {
  const node = nodeId ? getNodeById(nodeId) : undefined;
  return {
    x: node?.x ?? 50,
    y: node?.y ?? 50,
    zoom: FOLLOW_ZOOM,
  };
}

function clusterSpread(nodeIds: string[]): number {
  const nodes = nodeIds
    .map((id) => getNodeById(id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  if (nodes.length < 2) return 0;
  let minX = 100;
  let maxX = 0;
  let minY = 100;
  let maxY = 0;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

/**
 * Mario Party–like board camera: overview intro, smooth follow, dynamic zoom,
 * brief event pans, and board-event pulse.
 */
export default function BoardCameraViewport({
  children,
  followNodeId,
  playerNodeIds = [],
  eventFocus = null,
  playIntro = false,
  onIntroComplete,
  boardEventPulse = 0,
  className = "",
}: Props) {
  const [pose, setPose] = useState<CameraPose>({ x: 50, y: 50, zoom: OVERVIEW_ZOOM });
  const poseRef = useRef(pose);
  const targetRef = useRef<CameraPose>({ x: 50, y: 50, zoom: OVERVIEW_ZOOM });
  const modeRef = useRef<BoardCameraMode>("follow");
  const introRanRef = useRef(false);
  const eventUntilRef = useRef(0);
  const boardPulseUntilRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const setTarget = useCallback((next: CameraPose, mode: BoardCameraMode) => {
    targetRef.current = next;
    modeRef.current = mode;
  }, []);

  // Match-start overview: full board → landmark pans → zoom into start.
  useEffect(() => {
    if (!playIntro || introRanRef.current) return;
    introRanRef.current = true;
    let cancelled = false;
    const landmarks = listBoardLandmarks();
    const sequence: { pose: CameraPose; hold: number }[] = [
      { pose: { x: 50, y: 50, zoom: OVERVIEW_ZOOM }, hold: 900 },
      ...landmarks.map((lm) => ({
        pose: { ...nodePose(lm.id), zoom: EVENT_ZOOM },
        hold: 700,
      })),
      { pose: { ...nodePose("start"), zoom: FOLLOW_ZOOM }, hold: 800 },
    ];

    (async () => {
      for (const step of sequence) {
        if (cancelled) return;
        setTarget(step.pose, "overview");
        await new Promise((r) => setTimeout(r, step.hold));
      }
      if (cancelled) return;
      modeRef.current = "follow";
      onIntroComplete?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [playIntro, onIntroComplete, setTarget]);

  // Event focus (spike / shop / area ult).
  useEffect(() => {
    if (!eventFocus?.nodeId) return;
    const hold = eventFocus.holdMs ?? 1200;
    eventUntilRef.current = performance.now() + hold;
    setTarget(
      { ...nodePose(eventFocus.nodeId), zoom: EVENT_ZOOM },
      eventFocus.mode ?? "event"
    );
  }, [eventFocus, setTarget]);

  // Board-wide event pulse.
  useEffect(() => {
    if (!boardEventPulse) return;
    boardPulseUntilRef.current = performance.now() + 1400;
    setTarget({ x: 50, y: 50, zoom: BOARD_EVENT_ZOOM }, "board-event");
  }, [boardEventPulse, setTarget]);

  // Follow + dynamic zoom target (when not in overview/event hold).
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      if (modeRef.current === "overview") {
        // intro owns target
      } else if (now < eventUntilRef.current) {
        // event hold
      } else if (now < boardPulseUntilRef.current) {
        // board pulse hold
      } else {
        const spread = clusterSpread(
          playerNodeIds.length > 0
            ? playerNodeIds
            : followNodeId
              ? [followNodeId]
              : []
        );
        const zoom =
          spread > 28 ? CLUSTER_ZOOM : spread > 14 ? 1.35 : FOLLOW_ZOOM;
        setTarget({ ...nodePose(followNodeId), zoom }, "follow");
      }

      const cur = poseRef.current;
      const tgt = targetRef.current;
      const next: CameraPose = {
        x: cur.x + (tgt.x - cur.x) * LERP,
        y: cur.y + (tgt.y - cur.y) * LERP,
        zoom: cur.zoom + (tgt.zoom - cur.zoom) * LERP,
      };
      poseRef.current = next;
      setPose(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [followNodeId, playerNodeIds, setTarget]);

  const zoom = clamp(pose.zoom, 1, 2.2);
  const tx = 50 - pose.x;
  const ty = 50 - pose.y;

  return (
    <div className={`board-camera-viewport ${className}`.trim()}>
      <div
        className="board-camera-stage"
        style={{
          transformOrigin: `${pose.x}% ${pose.y}%`,
          transform: `translate(${tx}%, ${ty}%) scale(${zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Compact full-board minimap with player dots and landmarks. */
export function BoardMinimap({
  players,
  currentPlayerIndex,
  activeSpikeNodeId,
}: {
  players: { position: string; name?: string }[];
  currentPlayerIndex: number;
  activeSpikeNodeId?: string | null;
}) {
  const shops = boardLayout.filter((n) => n.type === "shop");
  const spikes = boardLayout.filter((n) => n.type === "spike");
  const start = getNodeById("start");

  return (
    <div className="board-minimap" aria-label="Board minimap">
      <svg viewBox="0 0 100 100" className="board-minimap__svg" aria-hidden>
        {boardLayout.flatMap((node) =>
          node.next.map((nextId) => {
            const next = getNodeById(nextId);
            if (!next) return null;
            return (
              <line
                key={`${node.id}-${nextId}`}
                x1={node.x}
                y1={node.y}
                x2={next.x}
                y2={next.y}
                className="board-minimap__path"
              />
            );
          })
        )}
        {shops.map((n) => (
          <circle key={`shop-${n.id}`} cx={n.x} cy={n.y} r={1.6} className="board-minimap__shop" />
        ))}
        {spikes.map((n) => (
          <circle
            key={`spike-${n.id}`}
            cx={n.x}
            cy={n.y}
            r={1.6}
            className={
              activeSpikeNodeId === n.id
                ? "board-minimap__spike board-minimap__spike--active"
                : "board-minimap__spike"
            }
          />
        ))}
        {start && (
          <circle cx={start.x} cy={start.y} r={2.2} className="board-minimap__start" />
        )}
        {players.map((p, i) => {
          const node = getNodeById(p.position);
          if (!node) return null;
          const active = i === currentPlayerIndex;
          return (
            <circle
              key={`p-${i}`}
              cx={node.x}
              cy={node.y}
              r={active ? 2.4 : 1.7}
              className={
                active
                  ? "board-minimap__player board-minimap__player--active"
                  : "board-minimap__player"
              }
            />
          );
        })}
      </svg>
      <p className="board-minimap__label">Map</p>
    </div>
  );
}
