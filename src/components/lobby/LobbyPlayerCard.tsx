import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import {
  agentBackgroundPath,
  randomBackgroundPath,
  randomPortraitPath,
} from "../../game/assetPaths";
import PlayerNameWithBadge from "./PlayerNameWithBadge";

const AGENT_BG_ANIMATION_MS = 220;
const RANDOM_VISUAL_KEY = "__random__";

type LobbyPlayerCardProps = {
  name: string;
  avatar?: string;
  /** Original profile image URL — used for Twitch badge detection only. */
  profileAvatar?: string;
  agentIcon?: string | null;
  agentPortrait?: string | null;
  agentName?: string;
  twitchLogin?: string;
  twitchImportedName?: string;
  isActive?: boolean;
  isYou?: boolean;
  isHost?: boolean;
  isReady?: boolean;
  isEmpty?: boolean;
  isRandomizePending?: boolean;
  mirrored?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  onClick?: () => void;
  headerAction?: ReactNode;
  editableName?: boolean;
  onNameChange?: (name: string) => void;
  onAvatarClick?: () => void;
  avatarInput?: ReactNode;
};

function LobbyPlayerCard({
  name,
  avatar,
  profileAvatar,
  agentIcon,
  agentPortrait,
  agentName,
  twitchLogin,
  twitchImportedName,
  isActive = false,
  isYou = false,
  isHost = false,
  isReady = false,
  isEmpty = false,
  isRandomizePending = false,
  mirrored = false,
  emptyTitle = "Empty slot",
  emptySubtitle = "Add a player to fill this slot",
  onClick,
  headerAction,
  editableName = false,
  onNameChange,
  onAvatarClick,
  avatarInput,
}: LobbyPlayerCardProps) {
  const visualKey = isRandomizePending ? RANDOM_VISUAL_KEY : agentName;
  const resolvedPortrait = isRandomizePending
    ? randomPortraitPath()
    : agentPortrait ?? null;

  const { layers, clearTransition, clearExitingPortrait } = useAgentCardTransition(
    isEmpty ? undefined : visualKey,
    isEmpty ? null : resolvedPortrait
  );

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-[140px] flex-col rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 p-4 opacity-60 sm:min-h-0 sm:p-5">
        <div
          className={`flex h-full flex-col gap-3 sm:items-center sm:gap-4 ${
            mirrored ? "sm:flex-row-reverse" : "sm:flex-row"
          }`}
        >
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl text-zinc-500 sm:h-24 sm:w-24">
            +
          </div>
          <div className={`min-w-0 ${mirrored ? "sm:text-right" : ""}`}>
            <p className="text-base font-medium text-zinc-500 sm:text-lg">
              {emptyTitle}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{emptySubtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  const showPortrait = !!resolvedPortrait;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group relative flex h-full min-h-[140px] flex-col overflow-hidden rounded-2xl border p-4 sm:min-h-0 sm:p-5 ${
        isActive
          ? "border-cyan-400/50 bg-cyan-400/5 ring-1 ring-cyan-400/30 transition-none"
          : isYou
            ? "border-cyan-400/30 bg-cyan-400/5 transition-none"
            : isRandomizePending
              ? "border-violet-400/25 bg-violet-500/5 transition-[border-color] duration-50 ease-out"
              : "border-white/10 bg-zinc-900/70 transition-[border-color] duration-50 ease-out"
      } ${onClick ? "cursor-pointer hover:border-white/20" : ""}`}
    >
      <AgentBackgroundLayers
        layers={layers}
        mirrored={mirrored}
        hasPortrait={showPortrait}
        onTransitionEnd={clearTransition}
      />

      {resolvedPortrait && (
        <AgentPortraitLayers
          layers={layers}
          portrait={resolvedPortrait}
          alt={isRandomizePending ? "Random agent" : agentName ?? "Agent"}
          mirrored={mirrored}
          isActive={isActive}
          isRandom={isRandomizePending}
          onTransitionEnd={clearTransition}
          onExitPortraitEnd={clearExitingPortrait}
        />
      )}

      {headerAction}

      {isReady && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-emerald-950/40 backdrop-blur-[1px]"
          aria-hidden
        >
          <span className="select-none text-4xl font-black uppercase tracking-[0.15em] text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.55)] sm:text-5xl">
            Ready!
          </span>
        </div>
      )}

      <div
        className={`relative z-10 flex h-full min-w-0 flex-col gap-4 ${
          showPortrait ? (mirrored ? "pl-[25%]" : "pr-[25%]") : ""
        }`}
      >
        <div
          className={`flex items-start gap-3 sm:gap-4 ${
            mirrored ? "justify-end" : ""
          }`}
        >
          {!mirrored && (
            <PlayerAvatarBlock
              avatar={avatar}
              agentIcon={agentIcon}
              name={name}
              onAvatarClick={onAvatarClick}
              avatarInput={avatarInput}
            />
          )}

          <div className={`min-w-0 ${mirrored ? "text-right" : ""}`}>
            <div
              className={`flex flex-wrap items-start gap-2 ${
                mirrored ? "justify-end" : ""
              }`}
            >
              <PlayerNameWithBadge
                name={name}
                twitchLogin={twitchLogin}
                twitchImportedName={twitchImportedName}
                avatar={profileAvatar ?? avatar}
                align={mirrored ? "right" : "left"}
                editable={editableName && !!onNameChange}
                onNameChange={onNameChange}
                onClick={(event) => event.stopPropagation()}
              />

              {isHost && (
                <span
                  className="text-base leading-none drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                  title="Host"
                  aria-label="Host"
                >
                  👑
                </span>
              )}
              {isActive && (
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  Selecting
                </span>
              )}
              {isRandomizePending && (
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                  Random
                </span>
              )}
            </div>
          </div>

          {mirrored && (
            <PlayerAvatarBlock
              avatar={avatar}
              agentIcon={agentIcon}
              name={name}
              onAvatarClick={onAvatarClick}
              avatarInput={avatarInput}
            />
          )}
        </div>

        <div
          className={`mt-auto min-w-0 ${
            mirrored ? "text-right" : "text-left"
          }`}
        >
          <p className="truncate text-sm text-zinc-400">
            {isRandomizePending
              ? "Random agent on start"
              : agentName ?? "No agent selected"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(LobbyPlayerCard);

function PlayerAvatarBlock({
  avatar,
  agentIcon,
  name,
  onAvatarClick,
  avatarInput,
}: {
  avatar?: string;
  agentIcon?: string | null;
  name: string;
  onAvatarClick?: () => void;
  avatarInput?: ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      {onAvatarClick ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAvatarClick();
          }}
          className="group/avatar relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/25 to-cyan-400/20 text-2xl font-bold transition-[transform,box-shadow] duration-50 ease-out hover:scale-[1.02] hover:ring-2 hover:ring-cyan-400/40 sm:h-28 sm:w-28"
          title="Change avatar"
        >
          <AvatarContent avatar={avatar} agentIcon={agentIcon} name={name} />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-semibold text-white opacity-0 transition-[opacity,background-color] duration-50 ease-out group-hover/avatar:bg-black/35 group-hover/avatar:opacity-100">
            Change
          </div>
        </button>
      ) : (
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/25 to-cyan-400/20 text-2xl font-bold sm:h-28 sm:w-28">
          <AvatarContent avatar={avatar} agentIcon={agentIcon} name={name} />
        </div>
      )}

      {avatarInput}
    </div>
  );
}

function AgentPortraitLayers({
  layers,
  portrait,
  alt,
  mirrored,
  isActive,
  isRandom = false,
  onTransitionEnd,
  onExitPortraitEnd,
}: {
  layers: AgentCardTransitionState;
  portrait: string;
  alt: string;
  mirrored: boolean;
  isActive: boolean;
  isRandom?: boolean;
  onTransitionEnd: () => void;
  onExitPortraitEnd: () => void;
}) {
  const sideClass = mirrored
    ? "lobby-agent-portrait--left"
    : "lobby-agent-portrait--right";

  return (
    <div
      className={`lobby-agent-portrait ${isRandom ? "lobby-randomize-portrait" : ""} ${sideClass}${
        isActive ? " lobby-agent-portrait--active" : ""
      }`}
      title={alt}
    >
      {layers.exitingPortrait && (
        <AgentPortraitImage
          key={`exit-${layers.exitingPortrait}`}
          src={layers.exitingPortrait}
          alt={alt}
          mirrored={mirrored}
          animationClass="animate-agentPortraitSlideOut"
          layerClassName="z-[2]"
          onAnimationEnd={(event) => {
            if (event.animationName !== "agentPortraitSlideOut") return;
            onExitPortraitEnd();
          }}
        />
      )}
      <AgentPortraitImage
        key={`portrait-${portrait}`}
        src={portrait}
        alt={alt}
        mirrored={mirrored}
        animationClass={
          layers.entering ? "animate-agentPortraitSlideIn" : undefined
        }
        layerClassName="z-[1]"
        onAnimationEnd={
          layers.entering
            ? (event) => {
                if (event.animationName !== "agentPortraitSlideIn") return;
                onTransitionEnd();
              }
            : undefined
        }
      />
    </div>
  );
}

function AgentPortraitImage({
  src,
  alt,
  mirrored,
  animationClass,
  layerClassName,
  onAnimationEnd,
}: {
  src: string;
  alt: string;
  mirrored: boolean;
  animationClass?: string;
  layerClassName?: string;
  onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void;
}) {
  const isRandom = src === randomPortraitPath();

  return (
    <div
      className={`lobby-agent-portrait-layer ${layerClassName ?? ""} ${
        animationClass ?? ""
      }`}
      onAnimationEnd={onAnimationEnd}
    >
      <img
        src={src}
        alt={alt}
        className={
          isRandom
            ? "lobby-randomize-portrait-img"
            : mirrored
              ? ""
              : "lobby-agent-portrait-img--mirrored"
        }
      />
    </div>
  );
}

type AgentCardTransitionState = {
  current: string | null;
  exiting: string | null;
  entering: string | null;
  exitingPortrait: string | null;
};

function useAgentCardTransition(
  agentName?: string,
  agentPortrait?: string | null
) {
  const prevAgentRef = useRef<string | undefined>(agentName);
  const prevPortraitRef = useRef<string | null | undefined>(agentPortrait);
  const [layers, setLayers] = useState<AgentCardTransitionState>(() =>
    agentName
      ? {
          current: agentName,
          exiting: null,
          entering: null,
          exitingPortrait: null,
        }
      : {
          current: null,
          exiting: null,
          entering: null,
          exitingPortrait: null,
        }
  );

  useLayoutEffect(() => {
    if (!agentName) {
      prevAgentRef.current = undefined;
      prevPortraitRef.current = undefined;
      setLayers({
        current: null,
        exiting: null,
        entering: null,
        exitingPortrait: null,
      });
      return;
    }

    const prev = prevAgentRef.current;
    if (prev === agentName) return;

    const prevPortrait = prevPortraitRef.current ?? null;

    if (!prev) {
      prevAgentRef.current = agentName;
      prevPortraitRef.current = agentPortrait;
      setLayers({
        current: agentName,
        exiting: null,
        entering: agentName,
        exitingPortrait: null,
      });
      return;
    }

    prevAgentRef.current = agentName;
    prevPortraitRef.current = agentPortrait;
    setLayers({
      current: agentName,
      exiting: prev,
      entering: agentName,
      exitingPortrait: prevPortrait,
    });
  }, [agentName, agentPortrait]);

  useLayoutEffect(() => {
    if (!layers.entering) return;

    const timer = window.setTimeout(() => {
      setLayers((state) => {
        if (!state.entering) return state;
        return {
          current: state.current,
          exiting: null,
          entering: null,
          exitingPortrait: null,
        };
      });
    }, AGENT_BG_ANIMATION_MS + 32);

    return () => window.clearTimeout(timer);
  }, [layers.entering, layers.current]);

  const clearTransition = useCallback(() => {
    setLayers((state) => {
      if (!state.entering) return state;
      return {
        current: state.current,
        exiting: null,
        entering: null,
        exitingPortrait: null,
      };
    });
  }, []);

  const clearExitingPortrait = useCallback(() => {
    setLayers((state) => {
      if (!state.exitingPortrait) return state;
      return { ...state, exitingPortrait: null };
    });
  }, []);

  return { layers, clearTransition, clearExitingPortrait };
}

function backgroundPathForVisualKey(visualKey: string): string {
  return visualKey === RANDOM_VISUAL_KEY
    ? randomBackgroundPath()
    : agentBackgroundPath(visualKey);
}

function AgentBackgroundLayers({
  layers,
  mirrored,
  hasPortrait,
  onTransitionEnd,
}: {
  layers: AgentCardTransitionState;
  mirrored: boolean;
  hasPortrait: boolean;
  onTransitionEnd: () => void;
}) {
  const { current } = layers;
  if (!current) return null;

  const zoneClass = hasPortrait
    ? mirrored
      ? "agent-bg-text-zone--left"
      : "agent-bg-text-zone--right"
    : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {layers.exiting && (
        <AgentBackgroundImage
          key={`exit-${layers.exiting}`}
          src={backgroundPathForVisualKey(layers.exiting)}
          animationClass="animate-agentBgSlideOut"
          layerClassName="z-[2]"
          zoneClassName={zoneClass}
        />
      )}
      <AgentBackgroundImage
        key={`bg-${current}`}
        src={backgroundPathForVisualKey(current)}
        animationClass={
          layers.entering ? "animate-agentBgSlideIn" : undefined
        }
        layerClassName="z-[1]"
        zoneClassName={zoneClass}
        onAnimationEnd={
          layers.entering
            ? (event) => {
                if (event.animationName !== "agentBgSlideIn") return;
                onTransitionEnd();
              }
            : undefined
        }
      />
    </div>
  );
}

function AgentBackgroundImage({
  src,
  animationClass,
  layerClassName,
  zoneClassName,
  onAnimationEnd,
}: {
  src: string;
  animationClass?: string;
  layerClassName?: string;
  zoneClassName?: string;
  onAnimationEnd?: (event: AnimationEvent<HTMLImageElement>) => void;
}) {
  return (
    <div
      className={`agent-bg-text-layer ${zoneClassName ?? ""} ${
        layerClassName ?? ""
      }`}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        onAnimationEnd={onAnimationEnd}
        className={`agent-bg-text-img ${
          zoneClassName ? "agent-bg-text-img--content-zone" : ""
        } opacity-20 ${animationClass ?? ""}`}
      />
    </div>
  );
}

function AvatarContent({
  avatar,
  agentIcon,
  name,
}: {
  avatar?: string;
  agentIcon?: string | null;
  name: string;
}) {
  if (avatar) {
    return (
      <img src={avatar} alt={name} className="h-full w-full object-contain" />
    );
  }

  if (agentIcon) {
    return (
      <img
        src={agentIcon}
        alt={name}
        className="h-full w-full object-contain"
      />
    );
  }

  return <span>{(name.trim().charAt(0) || "?").toUpperCase()}</span>;
}
