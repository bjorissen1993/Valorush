import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "valorush-performance-mode";

function readStoredMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isEffectivePerformanceMode(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("performance-mode") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function usePerformanceSettings() {
  const [performanceMode, setPerformanceModeState] = useState(readStoredMode);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tabVisible, setTabVisible] = useState(
    () =>
      typeof document !== "undefined"
        ? document.visibilityState === "visible"
        : true
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onVisibility = () =>
      setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const setPerformanceMode = useCallback((enabled: boolean) => {
    setPerformanceModeState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const effectivePerformanceMode = performanceMode || reduceMotion;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("performance-mode", effectivePerformanceMode);
    root.classList.toggle("tab-hidden", !tabVisible);
  }, [effectivePerformanceMode, tabVisible]);

  return {
    performanceMode,
    effectivePerformanceMode,
    reduceMotion,
    tabVisible,
    setPerformanceMode,
    togglePerformanceMode: () => setPerformanceMode(!performanceMode),
  };
}
