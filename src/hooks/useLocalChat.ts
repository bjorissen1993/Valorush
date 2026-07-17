import { useCallback, useEffect, useState } from "react";
import type { LobbyChatMessage } from "../../shared/lobbyTypes";
import {
  clearLocalChat,
  createLocalPlayerChatMessage,
  createLocalSystemChatMessage,
  hasLocalChatJoinSeed,
  markLocalChatJoinSeed,
  readLocalChatMessages,
  writeLocalChatMessages,
} from "../services/localChatStore";

const MAX_MESSAGES = 200;

/**
 * Local pass-and-play chat: React state mirrored to localStorage
 * (`valorush_local_chat`) so lobby → game and refresh keep the same history.
 */
export function useLocalChat(enabled: boolean) {
  const [messages, setMessages] = useState<LobbyChatMessage[]>(() =>
    enabled ? readLocalChatMessages() : []
  );

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      return;
    }
    setMessages(readLocalChatMessages());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    writeLocalChatMessages(messages);
  }, [enabled, messages]);

  const appendMessages = useCallback(
    (next: LobbyChatMessage | LobbyChatMessage[]) => {
      const batch = Array.isArray(next) ? next : [next];
      if (batch.length === 0) return;
      setMessages((prev) => {
        const merged = [...prev, ...batch];
        return merged.length > MAX_MESSAGES
          ? merged.slice(merged.length - MAX_MESSAGES)
          : merged;
      });
    },
    []
  );

  const sendChatMessage = useCallback(
    (text: string, playerId: string, playerName: string) => {
      if (!enabled) return;
      const message = createLocalPlayerChatMessage(text, playerId, playerName);
      if (message) appendMessages(message);
    },
    [appendMessages, enabled]
  );

  const sendSystemChat = useCallback(
    (text: string) => {
      if (!enabled) return;
      const message = createLocalSystemChatMessage(text);
      if (message) appendMessages(message);
    },
    [appendMessages, enabled]
  );

  const seedJoinMessages = useCallback(
    (playerNames: string[]) => {
      if (!enabled) return;
      if (hasLocalChatJoinSeed()) return;
      markLocalChatJoinSeed();
      const batch = playerNames
        .map((name) =>
          createLocalSystemChatMessage(`${name} joined the game`)
        )
        .filter((message): message is LobbyChatMessage => message !== null);
      if (batch.length > 0) appendMessages(batch);
    },
    [appendMessages, enabled]
  );

  const resetChat = useCallback(() => {
    clearLocalChat();
    setMessages([]);
  }, []);

  return {
    messages,
    sendChatMessage,
    sendSystemChat,
    seedJoinMessages,
    resetChat,
  };
}

export { clearLocalChat };
