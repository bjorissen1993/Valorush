import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const DEFAULT_DELAY_MS = 1000;

type HoverTooltipProps = {
  content: ReactNode;
  children: ReactNode;
  delayMs?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Shows a tooltip after the pointer has hovered for `delayMs` (default 1000ms).
 * Hides immediately on mouse leave.
 */
export default function HoverTooltip({
  content,
  children,
  delayMs = DEFAULT_DELAY_MS,
  className = "",
  style,
}: HoverTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const showAfterDelay = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setVisible(true);
      timerRef.current = null;
    }, delayMs);
  }, [clearTimer, delayMs]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <span
      className={`hover-tooltip ${className}`.trim()}
      style={style}
      onMouseEnter={showAfterDelay}
      onMouseLeave={hide}
      onFocus={showAfterDelay}
      onBlur={hide}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="hover-tooltip__bubble"
        >
          {content}
        </span>
      )}
    </span>
  );
}
