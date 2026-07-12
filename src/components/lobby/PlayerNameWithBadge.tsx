import type { MouseEvent } from "react";
import TwitchBadge from "./TwitchBadge";
import { isTwitchPlayer } from "./lobbyPlayerUtils";

type PlayerNameWithBadgeProps = {
  name: string;
  twitchLogin?: string;
  twitchImportedName?: string;
  avatar?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Overrides the preset size class when set (e.g. dynamic loading-screen scaling). */
  fontSizeClass?: string;
  /** Stretch to fill the parent row so long names can truncate cleanly. */
  fullWidth?: boolean;
  align?: "left" | "center" | "right";
  editable?: boolean;
  onNameChange?: (name: string) => void;
  onClick?: (event: MouseEvent<HTMLInputElement>) => void;
  inputClassName?: string;
};

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
} as const;

const ICON_SIZE_CLASSES = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

const ALIGN_CLASSES = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} as const;

const INPUT_SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-lg sm:text-xl",
  lg: "text-xl sm:text-2xl",
} as const;

export default function PlayerNameWithBadge({
  name,
  twitchLogin,
  twitchImportedName,
  avatar,
  className = "",
  size = "md",
  fontSizeClass,
  fullWidth = false,
  align = "left",
  editable = false,
  onNameChange,
  onClick,
  inputClassName = "",
}: PlayerNameWithBadgeProps) {
  const fromTwitch = isTwitchPlayer({
    name,
    twitchLogin,
    twitchImportedName,
    avatar,
  });

  const textColorClass = fromTwitch ? "text-[#9146FF]" : "text-white";
  const resolvedFontSizeClass = fontSizeClass ?? SIZE_CLASSES[size];
  const layoutClassName = fullWidth
    ? "flex w-full min-w-0"
    : "inline-flex max-w-full truncate";
  const wrapperClassName = `${layoutClassName} items-center gap-1.5 font-bold ${resolvedFontSizeClass} ${textColorClass} ${ALIGN_CLASSES[align]} ${className}`;

  if (editable && onNameChange) {
    return (
      <span className={wrapperClassName}>
        {fromTwitch && (
          <TwitchBadge className={`${ICON_SIZE_CLASSES[size]} shrink-0`} />
        )}
        <input
          value={name}
          onClick={onClick}
          onChange={(event) => onNameChange(event.target.value)}
          className={`w-full min-w-0 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-semibold outline-none transition focus:border-red-400/40 ${INPUT_SIZE_CLASSES[size]} ${textColorClass} ${align === "right" ? "text-right" : "text-left"} ${inputClassName}`}
          placeholder="Enter player name"
          title={fromTwitch && twitchLogin ? `@${twitchLogin}` : name}
        />
      </span>
    );
  }

  return (
    <span
      className={wrapperClassName}
      title={fromTwitch && twitchLogin ? `@${twitchLogin}` : name}
    >
      {fromTwitch && (
        <TwitchBadge className={`${ICON_SIZE_CLASSES[size]} shrink-0`} />
      )}
      <span className={fullWidth ? "min-w-0 flex-1 truncate" : "truncate"}>
        {name}
      </span>
    </span>
  );
}
