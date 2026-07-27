import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { boardLayout, getNodeById, listBoardLandmarks } from "../game/boardLayout";

export type BoardCameraMode =
  | "overview"
  | "follow"
  | "event"
  | "board-event"
  | "manual";

export type BoardCameraFocus = {
  nodeId: string;
  mode?: BoardCameraMode;
  holdMs?: number;
};

export type BoardCameraHandle = {
  /** Pan/zoom the main camera to a layout-space point (e.g. minimap click). */
  navigateTo: (x: number, y: number, zoom?: number) => void;
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
const MANUAL_LERP = 0.28;
const FOLLOW_ZOOM = 1.55;
const CLUSTER_ZOOM = 1.2;
const OVERVIEW_ZOOM = 1;
const EVENT_ZOOM = 1.7;
const BOARD_EVENT_ZOOM = 1.05;
const MINIMAP_NAV_ZOOM = 1.45;
const MANUAL_RESUME_MS = 2600;
const DRAG_THRESHOLD_PX = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.2;

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
 * brief event pans, board-event pulse, plus user pan / wheel zoom / minimap nav.
 */
const BoardCameraViewport = forwardRef<BoardCameraHandle, Props>(
  function BoardCameraViewport(
    {
      children,
      followNodeId,
      playerNodeIds = [],
      eventFocus = null,
      playIntro = false,
      onIntroComplete,
      boardEventPulse = 0,
      className = "",
    },
    ref
  ) {
    const [pose, setPose] = useState<CameraPose>({
      x: 50,
      y: 50,
      zoom: OVERVIEW_ZOOM,
    });
    const [isPanning, setIsPanning] = useState(false);
    const poseRef = useRef(pose);
    const targetRef = useRef<CameraPose>({ x: 50, y: 50, zoom: OVERVIEW_ZOOM });
    const modeRef = useRef<BoardCameraMode>("follow");
    const introRanRef = useRef(false);
    const eventUntilRef = useRef(0);
    const boardPulseUntilRef = useRef(0);
    const manualUntilRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
    const dragLastRef = useRef<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const didPanRef = useRef(false);

    const setTarget = useCallback((next: CameraPose, mode: BoardCameraMode) => {
      targetRef.current = {
        x: clamp(next.x, 2, 98),
        y: clamp(next.y, 2, 98),
        zoom: clamp(next.zoom, MIN_ZOOM, MAX_ZOOM),
      };
      modeRef.current = mode;
    }, []);

    const enterManual = useCallback(
      (next: CameraPose, holdMs = MANUAL_RESUME_MS) => {
        setTarget(next, "manual");
        manualUntilRef.current = performance.now() + holdMs;
      },
      [setTarget]
    );

    useImperativeHandle(
      ref,
      () => ({
        navigateTo(x: number, y: number, zoom = MINIMAP_NAV_ZOOM) {
          enterManual({ x, y, zoom }, MANUAL_RESUME_MS + 800);
        },
      }),
      [enterManual]
    );

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
          manualUntilRef.current = 0;
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
      manualUntilRef.current = 0;
      setTarget(
        { ...nodePose(eventFocus.nodeId), zoom: EVENT_ZOOM },
        eventFocus.mode ?? "event"
      );
    }, [eventFocus, setTarget]);

    // Board-wide event pulse.
    useEffect(() => {
      if (!boardEventPulse) return;
      boardPulseUntilRef.current = performance.now() + 1400;
      manualUntilRef.current = 0;
      setTarget({ x: 50, y: 50, zoom: BOARD_EVENT_ZOOM }, "board-event");
    }, [boardEventPulse, setTarget]);

    // Soft re-follow after idle; also resume when the followed piece changes.
    useEffect(() => {
      manualUntilRef.current = Math.min(manualUntilRef.current, performance.now());
    }, [followNodeId]);

    // Follow + dynamic zoom target (when not in overview/event/manual hold).
    useEffect(() => {
      const tick = () => {
        const now = performance.now();
        if (modeRef.current === "overview") {
          // intro owns target
        } else if (now < eventUntilRef.current) {
          // event hold
        } else if (now < boardPulseUntilRef.current) {
          // board pulse hold
        } else if (isDraggingRef.current || now < manualUntilRef.current) {
          // user pan / minimap / wheel owns target
          if (!isDraggingRef.current && modeRef.current !== "manual") {
            modeRef.current = "manual";
          }
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
        const lerp =
          modeRef.current === "manual" && isDraggingRef.current
            ? MANUAL_LERP
            : LERP;
        const next: CameraPose = {
          x: cur.x + (tgt.x - cur.x) * lerp,
          y: cur.y + (tgt.y - cur.y) * lerp,
          zoom: cur.zoom + (tgt.zoom - cur.zoom) * lerp,
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

    const applyPanDelta = useCallback(
      (dxPx: number, dyPx: number) => {
        const el = viewportRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        const zoom = clamp(poseRef.current.zoom, MIN_ZOOM, MAX_ZOOM);
        const dxLayout = (-dxPx / rect.width) * 100 / zoom;
        const dyLayout = (-dyPx / rect.height) * 100 / zoom;
        const cur = targetRef.current;
        enterManual({
          x: cur.x + dxLayout,
          y: cur.y + dyLayout,
          zoom: cur.zoom,
        });
      },
      [enterManual]
    );

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // Ignore UI chrome inside the stage (banners, etc.) that should keep clicks.
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select")) return;

      didPanRef.current = false;
      isDraggingRef.current = false;
      dragOriginRef.current = { x: e.clientX, y: e.clientY };
      dragLastRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragLastRef.current || !dragOriginRef.current) return;
      const totalDx = e.clientX - dragOriginRef.current.x;
      const totalDy = e.clientY - dragOriginRef.current.y;
      if (
        !isDraggingRef.current &&
        Math.hypot(totalDx, totalDy) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        didPanRef.current = true;
        setIsPanning(true);
      }
      const dx = e.clientX - dragLastRef.current.x;
      const dy = e.clientY - dragLastRef.current.y;
      dragLastRef.current = { x: e.clientX, y: e.clientY };
      applyPanDelta(dx, dy);
    };

    const endPointerDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragLastRef.current == null) return;
      dragOriginRef.current = null;
      dragLastRef.current = null;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsPanning(false);
        manualUntilRef.current = performance.now() + MANUAL_RESUME_MS;
        modeRef.current = "manual";
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    };

    const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!didPanRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      didPanRef.current = false;
    };

    // Wheel zoom (non-passive so we can prevent page scroll).
    useEffect(() => {
      const el = viewportRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const cur = targetRef.current;
        const factor = Math.exp(-e.deltaY * 0.00115);
        enterManual({
          x: cur.x,
          y: cur.y,
          zoom: clamp(cur.zoom * factor, MIN_ZOOM, MAX_ZOOM),
        });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [enterManual]);

    const zoom = clamp(pose.zoom, MIN_ZOOM, MAX_ZOOM);
    const tx = 50 - pose.x;
    const ty = 50 - pose.y;

    return (
      <div
        ref={viewportRef}
        className={`board-camera-viewport ${isPanning ? "board-camera-viewport--panning" : ""} ${className}`.trim()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
        onClickCapture={onClickCapture}
      >
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
);

export default BoardCameraViewport;

/** Compact full-board minimap with player dots, landmarks, and click-to-navigate. */
export function BoardMinimap({
  players,
  currentPlayerIndex,
  activeSpikeNodeId,
  onNavigate,
}: {
  players: { position: string; name?: string }[];
  currentPlayerIndex: number;
  activeSpikeNodeId?: string | null;
  /** Layout-space focus when the user clicks the minimap. */
  onNavigate?: (x: number, y: number) => void;
}) {
  const shops = boardLayout.filter((n) => n.type === "shop");
  const spikes = boardLayout.filter((n) => n.type === "spike");
  const start = getNodeById("start");
  const interactive = typeof onNavigate === "function";

  const handleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!onNavigate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    onNavigate(x, y);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onNavigate) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onNavigate(50, 50);
  };

  return (
    <div
      className={`board-minimap ${interactive ? "board-minimap--interactive" : ""}`.trim()}
      aria-label="Board minimap — click to look around"
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <svg
        viewBox="0 0 100 100"
        className="board-minimap__svg"
        aria-hidden
        onClick={handleClick}
      >
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
