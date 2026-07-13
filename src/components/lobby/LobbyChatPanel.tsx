import { memo, useEffect, useRef, useState } from "react";
import type { LobbyChatMessage } from "../../../shared/lobbyTypes";

type LobbyChatPanelProps = {
  open: boolean;
  onClose: () => void;
  messages: LobbyChatMessage[];
  onSend: (text: string) => void;
  yourPlayerId: string | null;
};

function formatChatTime(sentAt: number): string {
  return new Date(sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LobbyChatPanel({
  open,
  onClose,
  messages,
  onSend,
  yourPlayerId,
}: LobbyChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Lobby Chat</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Close chat"
        >
          Close
        </button>
      </div>

      <div
        ref={listRef}
        className="valorant-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="flex flex-col gap-2">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No messages yet. Say hello!
            </p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="text-sm leading-snug">
                <span className="font-mono text-[10px] text-zinc-500">
                  {formatChatTime(message.sentAt)}
                </span>{" "}
                <span
                  className={
                    message.playerId === yourPlayerId
                      ? "font-semibold text-cyan-300"
                      : "font-semibold text-zinc-200"
                  }
                >
                  {message.playerName}
                </span>
                <span className="text-zinc-500">: </span>
                <span className="text-zinc-300">{message.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-white/10 px-3 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          placeholder="Type a message..."
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/40"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default memo(LobbyChatPanel);
