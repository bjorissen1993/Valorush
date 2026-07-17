import { useCallback, useState } from "react";

const STORAGE_KEY = "valorush_debug_mode";

function readStoredDebugMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** User preference for showing debug UI. Default OFF; persists across sessions. */
export function useDebugMode() {
  const [debugMode, setDebugModeState] = useState(readStoredDebugMode);

  const setDebugMode = useCallback((enabled: boolean) => {
    setDebugModeState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  return {
    debugMode,
    setDebugMode,
    toggleDebugMode: () => setDebugMode(!debugMode),
  };
}
