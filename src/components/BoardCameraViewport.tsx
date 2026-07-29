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
import { boardLayout, getNodeById, listPhysicalEdges } from "../game/boardLayout";

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
  /** Pan the main camera to a layout-space point (e.g. minimap click). */
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
  /** Extra players for cluster framing (layout positions). */
  playerNodeIds?: string[];
  /** One-shot focus (spike plant, shop discount, area ult). */
  eventFocus?: BoardCameraFocus | null;
  /** Run match-start overview once when true. */
  playIntro?: boolean;
  onIntroComplete?: () => void;
  /** Brief board-wide framing pulse. */
  boardEventPulse?: number;
  className?: string;
  /** When true, left-drag only pans if Alt is held (board editor tile dragging). */
  requireAltToPan?: boolean;
  /**
   * Lock to full-board framing: no follow, no auto zoom/pan-in, no wheel zoom.
   * Free pan stays manual (does not snap back to the player).
   * Also forced on when {@link FOLLOW_PLAYER_CAMERA} is false.
   */
  fitFullBoard?: boolean;
};

/**
 * Follow-camera: when true, the viewport smoothly centers on the active/moving player.
 * Off by default so the full board stays framed (center of layout, no snap-to-player).
 * Manual pan (drag / Alt-drag) and minimap jump still work either way.
 *
 * To re-enable player follow later: set this to `true`.
 */
export const FOLLOW_PLAYER_CAMERA = false;

const LERP = 0.12;
const MANUAL_LERP = 0.28;
/**
 * Auto zoom-in is disabled for now (editor usability + crisp CSS tiles).
 * Re-enable higher values later if cinematic zoom returns.
 */
const FOLLOW_ZOOM = 1;
const OVERVIEW_ZOOM = 1;
const EVENT_ZOOM = 1;
const BOARD_EVENT_ZOOM = 1;
const MINIMAP_NAV_ZOOM = 1;
const FULL_BOARD_POSE: CameraPose = { x: 50, y: 50, zoom: OVERVIEW_ZOOM };
const MANUAL_RESUME_MS = 2600;
const DRAG_THRESHOLD_PX = 6;
/** Locked at 1× — no zoom in/out until re-enabled intentionally. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 1;
const WHEEL_ZOOM_ENABLED = false;

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

/**
 * Board camera: optional player follow, event pans, user pan / minimap.
 * Auto zoom-in and match-start cinematic flyover are disabled for now.
 * Player follow is gated by {@link FOLLOW_PLAYER_CAMERA} (off by default).
 */
const BoardCameraViewport = forwardRef<BoardCameraHandle, Props>(
  function BoardCameraViewport(
    {
      children,
      followNodeId,
      playerNodeIds: _playerNodeIds = [],
      eventFocus = null,
      playIntro = false,
      onIntroComplete,
      boardEventPulse = 0,
      className = "",
      requireAltToPan = false,
      fitFullBoard = false,
    },
    ref
  ) {
    // Full-board lock whenever follow is disabled, or when the editor forces it.
    const lockFullBoard = fitFullBoard || !FOLLOW_PLAYER_CAMERA;

    const [pose, setPose] = useState<CameraPose>(() =>
      lockFullBoard ? FULL_BOARD_POSE : { ...nodePose(followNodeId), zoom: FOLLOW_ZOOM }
    );
    const [isPanning, setIsPanning] = useState(false);
    const poseRef = useRef(pose);
    const targetRef = useRef<CameraPose>(
      lockFullBoard ? FULL_BOARD_POSE : { ...nodePose(followNodeId), zoom: FOLLOW_ZOOM }
    );
    const modeRef = useRef<BoardCameraMode>(lockFullBoard ? "overview" : "follow");
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
    const lockFullBoardRef = useRef(lockFullBoard);

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
        setTarget({ ...next, zoom: FOLLOW_ZOOM }, "manual");
        // In full-board mode, never auto-resume follow — keep free pan.
        manualUntilRef.current = lockFullBoardRef.current
          ? Number.POSITIVE_INFINITY
          : performance.now() + holdMs;
      },
      [setTarget]
    );

    useImperativeHandle(
      ref,
      () => ({
        navigateTo(x: number, y: number, _zoom = MINIMAP_NAV_ZOOM) {
          enterManual({ x, y, zoom: FOLLOW_ZOOM }, MANUAL_RESUME_MS + 800);
        },
      }),
      [enterManual]
    );

    // Enter/leave full-board framing (follow disabled, or board editor open).
    useEffect(() => {
      lockFullBoardRef.current = lockFullBoard;
      if (!lockFullBoard) {
        // Leaving full-board lock: allow follow to resume immediately.
        manualUntilRef.current = Math.min(manualUntilRef.current, performance.now());
        return;
      }
      eventUntilRef.current = 0;
      boardPulseUntilRef.current = 0;
      manualUntilRef.current = 0;
      setTarget(FULL_BOARD_POSE, "overview");
      poseRef.current = FULL_BOARD_POSE;
      setPose(FULL_BOARD_POSE);
    }, [lockFullBoard, setTarget]);

    // Match-start cinematic disabled — skip straight to follow framing.
    useEffect(() => {
      if (lockFullBoard) return;
      if (!playIntro || introRanRef.current) return;
      introRanRef.current = true;
      modeRef.current = "follow";
      setTarget({ ...nodePose(followNodeId ?? "start"), zoom: FOLLOW_ZOOM }, "follow");
      onIntroComplete?.();
    }, [playIntro, onIntroComplete, setTarget, followNodeId, lockFullBoard]);

    // Event focus (spike / shop / area ult) — pan only, no zoom-in.
    useEffect(() => {
      if (lockFullBoard) return;
      if (!eventFocus?.nodeId) return;
      const hold = eventFocus.holdMs ?? 1200;
      eventUntilRef.current = performance.now() + hold;
      manualUntilRef.current = 0;
      setTarget(
        { ...nodePose(eventFocus.nodeId), zoom: EVENT_ZOOM },
        eventFocus.mode ?? "event"
      );
    }, [eventFocus, setTarget, lockFullBoard]);

    // Board-wide event pulse — center board, no zoom.
    useEffect(() => {
      if (lockFullBoard) return;
      if (!boardEventPulse) return;
      boardPulseUntilRef.current = performance.now() + 1400;
      manualUntilRef.current = 0;
      setTarget({ x: 50, y: 50, zoom: BOARD_EVENT_ZOOM }, "board-event");
    }, [boardEventPulse, setTarget, lockFullBoard]);

    // Soft re-follow after idle; also resume when the followed piece changes.
    useEffect(() => {
      if (lockFullBoard) return;
      manualUntilRef.current = Math.min(manualUntilRef.current, performance.now());
    }, [followNodeId, lockFullBoard]);

    // Follow target (when not in overview/event/manual hold). Zoom stays locked at 1×.
    useEffect(() => {
      const tick = () => {
        const now = performance.now();
        if (lockFullBoardRef.current) {
          if (isDraggingRef.current || now < manualUntilRef.current) {
            if (!isDraggingRef.current && modeRef.current !== "manual") {
              modeRef.current = "manual";
            }
          } else {
            setTarget(FULL_BOARD_POSE, "overview");
          }
        } else if (modeRef.current === "overview") {
          // intro owns target
        } else if (now < eventUntilRef.current) {
          // event hold
        } else if (now < boardPulseUntilRef.current) {
          // board pulse hold
        } else if (isDraggingRef.current || now < manualUntilRef.current) {
          // user pan / minimap owns target
          if (!isDraggingRef.current && modeRef.current !== "manual") {
            modeRef.current = "manual";
          }
        } else {
          setTarget(
            { ...nodePose(followNodeId), zoom: FOLLOW_ZOOM },
            "follow"
          );
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
    }, [followNodeId, setTarget]);

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
          zoom: FOLLOW_ZOOM,
        });
      },
      [enterManual]
    );

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (requireAltToPan && !e.altKey) return;
      // Ignore UI chrome inside the stage (banners, etc.) that should keep clicks.
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select")) return;
      if (target?.closest(".board-tile, .board-tile-host")) return;

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
        manualUntilRef.current = lockFullBoardRef.current
          ? Number.POSITIVE_INFINITY
          : performance.now() + MANUAL_RESUME_MS;
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

    // Wheel zoom disabled globally for now (does not fight the board editor).
    useEffect(() => {
      if (!WHEEL_ZOOM_ENABLED) return;
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
        {listPhysicalEdges().map(({ from, to }) => {
          const a = getNodeById(from);
          const b = getNodeById(to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="board-minimap__path"
            />
          );
        })}
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
