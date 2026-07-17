import { useCallback, useState } from "react";

const STORAGE_KEY = "valorush_chat_game_events";

function readStoredChatGameEvents(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

/** Preference for posting notable game events into the shared room chat. Default ON. */
export function useChatGameEvents() {
  const [chatGameEvents, setChatGameEventsState] = useState(
    readStoredChatGameEvents
  );

  const setChatGameEvents = useCallback((enabled: boolean) => {
    setChatGameEventsState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  return {
    chatGameEvents,
    setChatGameEvents,
    toggleChatGameEvents: () => setChatGameEvents(!chatGameEvents),
  };
}
