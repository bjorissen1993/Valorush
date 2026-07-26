import { useLayoutEffect, useRef } from "react";

const DEFAULT_MIN_FONT_PX = 10;

type FitTextProps = {
  text: string;
  className?: string;
  /** Floor font size in px when shrinking to fit. */
  minFontSize?: number;
};

/**
 * Renders single-line text and shrinks font-size by 1px steps until the full
 * string fits (scrollWidth <= clientWidth), or until minFontSize is reached.
 */
export default function FitText({
  text,
  className,
  minFontSize = DEFAULT_MIN_FONT_PX,
}: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      // Reset so CSS clamp / base size is the starting point.
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      if (!Number.isFinite(base) || base <= 0) return;

      let size = base;
      el.style.fontSize = `${size}px`;

      while (el.scrollWidth > el.clientWidth + 0.5 && size > minFontSize) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const parent = el.parentElement;
    if (parent) ro.observe(parent);

    return () => ro.disconnect();
  }, [text, minFontSize]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
