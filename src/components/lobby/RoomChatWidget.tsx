import { memo, useEffect, useRef, useState } from "react";
import type { LobbyChatMessage } from "../../../shared/lobbyTypes";
import LobbyChatPanel from "./LobbyChatPanel";

type RoomChatWidgetProps = {
  messages: LobbyChatMessage[];
  onSend: (text: string) => void;
  yourPlayerId: string | null;
  title?: string;
  className?: string;
};

function RoomChatWidget({
  messages,
  onSend,
  yourPlayerId,
  title = "Chat",
  className = "",
}: RoomChatWidgetProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPanelMounted, setChatPanelMounted] = useState(false);
  const [lastReadChatCount, setLastReadChatCount] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  const unreadChatCount = chatOpen
    ? 0
    : Math.max(0, messages.length - lastReadChatCount);
  const latestUnreadMessage =
    !chatOpen && unreadChatCount > 0
      ? messages[messages.length - 1] ?? null
      : null;

  useEffect(() => {
    if (chatOpen) {
      setChatPanelMounted(true);
      setLastReadChatCount(messages.length);
    }
  }, [chatOpen, messages.length]);

  useEffect(() => {
    if (!chatOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && chatRef.current?.contains(target)) return;
      setChatOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [chatOpen]);

  function handleChatMorphTransitionEnd(
    event: React.TransitionEvent<HTMLDivElement>
  ) {
    if (event.propertyName !== "width" && event.propertyName !== "height") {
      return;
    }
    if (!chatOpen) {
      setChatPanelMounted(false);
    }
  }

  return (
    <div ref={chatRef} className={`relative ${className}`}>
      {unreadChatCount > 0 && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-[60] flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-zinc-950 animate-pulse">
          {unreadChatCount > 9 ? "9+" : unreadChatCount}
        </span>
      )}
      {!chatOpen && latestUnreadMessage && (
        <div
          className="pointer-events-none absolute right-0 top-12 z-[55] w-[min(calc(100vw-2.5rem),18rem)] rounded-xl border border-amber-300/40 bg-zinc-950/95 px-3 py-2 shadow-2xl backdrop-blur-md"
          aria-live="polite"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            New message
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {latestUnreadMessage.playerName}
          </p>
          <p className="truncate text-sm text-zinc-200">
            {latestUnreadMessage.text}
          </p>
        </div>
      )}
      <div
        onTransitionEnd={handleChatMorphTransitionEnd}
        className={`absolute right-0 top-0 z-50 origin-top-right rounded-xl border transition-[width,height,background-color,border-color,box-shadow] duration-300 ease-out ${
          chatOpen
            ? "h-[20rem] w-[22rem] max-w-[min(calc(100vw-2.5rem),22rem)] overflow-hidden border-cyan-400/40 bg-zinc-950/98 shadow-2xl backdrop-blur-md"
            : "h-10 w-10 border-white/10 bg-white/5"
        }`}
      >
        {chatPanelMounted ? (
          <LobbyChatPanel
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            messages={messages}
            onSend={onSend}
            yourPlayerId={yourPlayerId}
            title={title}
          />
        ) : (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="relative flex h-full w-full items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.15)] transition hover:border-cyan-300/50 hover:bg-cyan-500/20 hover:text-white"
            title={title}
            aria-label={
              unreadChatCount > 0
                ? `Open chat, ${unreadChatCount} unread message${unreadChatCount === 1 ? "" : "s"}`
                : `Open ${title.toLowerCase()}`
            }
            aria-expanded={false}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.375c-1.056 0-2.094.038-3.11.114a9.49 9.49 0 00-1.775 1.403 7.053 7.053 0 01-1.133.534A1.378 1.378 0 0112 21.75c-.995 0-1.933-.417-2.607-1.16a8.963 8.963 0 00-1.775-1.403 9.49 9.49 0 00-1.11-.114 48.901 48.901 0 00-3.476-.375c-1.978 0-3.348-1.024-3.348-2.97v-6.02c0-1.946 1.37-3.678 3.348-3.97A49.144 49.144 0 0112 2.25z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(RoomChatWidget);
