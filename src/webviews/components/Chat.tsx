// A little verse: chat holds threads for each agent, switch with care —
// messages belong to their agent; when you swap, they'll be there.
import React, { useEffect, useRef, useState } from "react";
import type { Agent, ChatMessage } from "gust-agents";
import { registerFileHandlers } from "webviews/utils/fileClient";
import ReactMarkdown from "react-markdown";
import vscode from "webviews/utils/vscodeClient";
import { FileOperationsPanel } from "./FileOperationsPanel";
import { Panel } from "./Panel";
import { AgentEntry } from "webviews/hooks/useAgentsFromProjects";
import { getSocket } from "shared/socket";
import { Agent as AgentClass } from "gust-agents";
import { useThinking } from "../ThinkingContext";

type Props = {
  // agent may be either a loaded Agent instance or an AgentEntry metadata object
  agent?: Agent | AgentEntry;
  sessionId?: string;
  // Callback when a new message arrives (for unread tracking)
  onMessage?: (message: ChatMessage) => void;
  // Whether this chat is currently visible/active
  isActive?: boolean;
};

type FileMessage = ChatMessage & {
  filePath?: string;
  operation?: string;
};

const storageKeyFor = (sessionId: string) => `gust:chat:${sessionId}:messagesByAgent`;
const storageKeyCurrentAgent = (sessionId: string) => `gust:chat:${sessionId}:currentAgentId`;

export const Chat: React.FC<Props> = ({ agent: agentProp, sessionId = "default", onMessage, isActive = true }) => {
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fileMessages, setFileMessages] = useState<FileMessage[]>([]);

  const [agentInstance, setAgentInstance] = useState<Agent | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  // Track which action messages are expanded (keyed by message id or index)
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});

  // Thinking indicator state — shows when the agent is processing or streaming a reply
  const { isThinking, setIsThinking } = useThinking();

  // Keep a ref pointing at the currently active agent id so streaming replies always
  // associate with the correct agent even if closures capture stale values.
  const activeAgentIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeAgentIdRef.current = currentAgentId;
  }, [currentAgentId]);

  // Keep refs for messages and messagesByAgent to avoid stale closures
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const messagesByAgentRef = useRef<Record<string, ChatMessage[]>>(messagesByAgent);
  useEffect(() => {
    messagesByAgentRef.current = messagesByAgent;
  }, [messagesByAgent]);

  // Persist/load message cache to localStorage per session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyFor(sessionId));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ChatMessage[]>;
        setMessagesByAgent(parsed || {});
      }
      const cur = localStorage.getItem(storageKeyCurrentAgent(sessionId));
      if (cur) setCurrentAgentId(cur);
    } catch (e) {
      console.warn("Failed to load persisted chats", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyFor(sessionId), JSON.stringify(messagesByAgent));
    } catch (e) {
      // ignore storage errors
    }
  }, [messagesByAgent, sessionId]);

  useEffect(() => {
    try {
      if (currentAgentId) {
        localStorage.setItem(storageKeyCurrentAgent(sessionId), currentAgentId);
      } else {
        localStorage.removeItem(storageKeyCurrentAgent(sessionId));
      }
    } catch (e) {
      // ignore
    }
  }, [currentAgentId, sessionId]);

  // Register file handlers once
  useEffect(() => {
    let mounted = true;
    registerFileHandlers((msg) => {
      if (!mounted) return;
      const parsed = parseFileMessage(msg.content);
      setFileMessages((prev) => [...prev, { ...msg, ...parsed }]);
    }).catch((e) => {
      // registerFileHandlers may not return a promise in some implementations; ignore errors
      console.warn("Failed to register file handlers", e);
    });

    return () => {
      mounted = false;
      // Note: If a clearFileHandlers utility exists it should be called here.
    };
  }, []);

  // Switch active agent without remounting the Chat component
  useEffect(() => {
    let cancelled = false;
    const prevAgentId = currentAgentId;

    const switchAgent = async () => {
      if (!agentProp) {
        // Persist current messages before clearing
        const prevKey = activeAgentIdRef.current ?? prevAgentId;
        if (prevKey && messagesRef.current.length > 0) {
          setMessagesByAgent((prev) => ({ ...prev, [prevKey]: messagesRef.current }));
        }
        setAgentInstance(null);
        setCurrentAgentId(null);
        activeAgentIdRef.current = null;
        setMessages([]);
        setIsThinking(false);
        return;
      }

      // Determine agent id (works for AgentEntry and Agent instance)
      const newAgentId = (agentProp as any).id as string;
      
      // Check if we're actually switching to a different agent
      if (newAgentId === currentAgentId) {
        // Same agent, no need to switch
        return;
      }

      // Persist previous agent messages using ref to avoid stale closures
      const prevKey = activeAgentIdRef.current ?? prevAgentId;
      if (prevKey && messagesRef.current.length > 0) {
        setMessagesByAgent((prev) => ({ ...prev, [prevKey]: messagesRef.current }));
      }

      setCurrentAgentId(newAgentId);
      // set ref immediately so any incoming replies during the switch are attributed correctly
      activeAgentIdRef.current = newAgentId;

      // If we have cached messages for this agent, restore them immediately
      const cached = messagesByAgentRef.current[newAgentId];
      if (cached) {
        setMessages(cached);
      } else {
        // Clear messages while we load history to avoid showing previous agent's messages
        setMessages([]);
      }

      // If agentProp already looks like a loaded Agent (has getChatHistory), use it
      if ((agentProp as any)?.getChatHistory && (agentProp as any)?.send) {
        const inst = agentProp as Agent;
        try {
          await inst.spawn();
        } catch (e) {
          // ignore spawn errors, we'll proceed
        }
        setAgentInstance(inst);

        try {
          const history = (await inst.getChatHistory(sessionId)) || [];
          if (cancelled) return;
          const filtered = history.filter((m: ChatMessage) => m.role === "user" || m.role === "assistant");
          setMessages(filtered);
          setMessagesByAgent((prev) => ({ ...prev, [newAgentId]: filtered }));
        } catch (e) {
          console.warn("Failed to load history from agent instance", e);
        }

        return;
      }

      // Otherwise, load the Agent instance from the backend using the shared socket
      try {
        const socket = await getSocket();
        const loaded = await AgentClass.load(newAgentId, socket, socket.userId);
        if (!loaded) {
          setAgentInstance(null);
          return;
        }
        try {
          await loaded.spawn();
        } catch (e) {
          // ignore spawn errors
        }
        if (cancelled) return;
        setAgentInstance(loaded);

        try {
          const history = (await loaded.getChatHistory(sessionId)) || [];
          if (cancelled) return;
          const filtered = history.filter((m: ChatMessage) => m.role === "user" || m.role === "assistant");
          setMessages(filtered);
          setMessagesByAgent((prev) => ({ ...prev, [newAgentId]: filtered }));
        } catch (e) {
          console.warn("Failed to load history from loaded agent", e);
        }
      } catch (err) {
        console.error("Failed to switch agent", err);
      }
    };

    switchAgent();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentProp, sessionId]);

  // Subscribe to replies from the currently loaded agent instance
  useEffect(() => {
    if (!agentInstance) return;
    const sub = agentInstance.onReply().subscribe((msg: ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        // Use the activeAgentIdRef to pick the correct key for message storage.
        const key = activeAgentIdRef.current ?? agentInstance.id;
        setMessagesByAgent((prevMap) => ({ ...prevMap, [key]: next }));
        return next;
      });
      // Notify parent about new message (for unread tracking)
      if (onMessage && (!isActive || msg.role === "assistant")) {
        onMessage(msg);
      }

      // When we receive assistant content, assume agent has started or finished thinking
      if (msg.role === "assistant") {
        // assistant messages may stream; clear thinking when we receive assistant content
        setIsThinking(false);
      }
    });
    return () => sub.unsubscribe();
  }, [agentInstance, onMessage, isActive, setIsThinking]);

  const scrollToBottom = () => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  };

  // Auto-scroll when messages change (after DOM updates)
  useEffect(() => {
    if (autoScroll.current && messages.length > 0) {
      // Use double requestAnimationFrame to ensure React has finished rendering
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScroll.current = distanceFromBottom < 100;
  };

  const handleSend = async () => {
    const trimmed = inputRef.current?.trim() ?? "";
    if (!trimmed || !agentInstance) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => {
      const next = [...prev, userMessage];
      const key = activeAgentIdRef.current ?? agentInstance.id;
      if (agentInstance) setMessagesByAgent((pm) => ({ ...pm, [key]: next }));
      return next;
    });
    setInput("");
    setIsSending(true);
    // Show thinking indicator as soon as the user sends a message — will be cleared when assistant replies
    setIsThinking(true);

    try {
      await agentInstance.send(userMessage, sessionId);
    } catch (e) {
      console.error("Failed to send message", e);
      // Optionally show a lightweight vscode notification
      vscode.postMessage({ type: "gust:client:error", payload: { message: "Failed to send message" } });
      setIsThinking(false);
    } finally {
      setIsSending(false);
      if (autoScroll.current) scrollToBottom();
    }
  };

  // -- Local input state refs (kept out of main render cycle to avoid remounts)
  const [input, setInput] = useState("");
  const inputRef = useRef("");
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  const [isSending, setIsSending] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle expanded state for action messages
  const toggleAction = (key: string) => {
    setExpandedActions((s) => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full min-h-0 overflow-hidden gap-0 lg:gap-4 p-0 lg:p-4">
      {/* Chat */}
      <div className="flex flex-col flex-1 min-w-0 bg-gradient-to-b from-[#0f1115] to-[#0c0e12] rounded-xl border border-[#2a2d34]/50 overflow-hidden shadow-lg shadow-black/20">
        {/* Header area with optional thinking indicator */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[#1b1d22]/60">
          <div className="text-sm text-white/90 font-medium truncate">{(agentInstance as any)?.id ?? ((agentProp as any)?.id ?? "No agent")}</div>
          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-white/70" role="status" aria-live="polite">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.15" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span>Agent denkt na…</span>
            </div>
          )}
        </div>

        <div ref={chatRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 min-h-0">
          {messages.map((msg, idx) => {
            const key = (msg as any).id ?? String(idx);
            const parsed = parseFileMessage(msg.content);
            const isAction = !!(parsed.operation || parsed.filePath);

            if (isAction) {
              const title = `${parsed.operation ?? 'file'}, ${parsed.filePath ?? 'unknown'} `;
              const expanded = !!expandedActions[key];
              return (
                <div key={key} className="max-w-2xl rounded-xl border border-[#233] bg-[#0f1418] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-white/90 font-medium truncate">{title}</div>
                    <div className="text-xs text-white/60">{new Date((msg.timestamp as number) || Date.now()).toLocaleTimeString()}</div>
                    <button
                      onClick={() => toggleAction(key)}
                      className="ml-2 text-xs px-2 py-1 rounded-md bg-[#13161d] text-white/80 border border-[#20232b] hover:bg-[#161a22]"
                    >
                      {expanded ? 'Hide details' : 'Show details'}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-3 text-sm text-gray-200">
                      <div className="mb-2 whitespace-pre-wrap"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      <div className="text-xs text-white/70">Parsed: <code className="font-mono">{JSON.stringify(parsed)}</code></div>
                    </div>
                  )}
                </div>
              );
            }

            // regular message
            return (
              <div
                key={key}
                className={`max-w-2xl px-5 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "ml-auto bg-blue-700 text-white shadow-md"
                    : "mr-auto bg-[#1a1d26] text-gray-100 border border-[#2a2d34]"
                }`}
              >
                <ReactMarkdown
                  components={{
                    code({ inline, children, ...props }) {
                      return (
                        <code className={`bg-black/60 text-green-400 rounded px-1 ${inline ? "text-sm" : "block p-2"}`} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            );
          })}

          {/* Typing indicator bubble shown while agent is thinking (assistant-aligned) */}
          {isThinking && (
            <div className="max-w-2xl mr-auto bg-[#1a1d26] text-gray-100 border border-[#2a2d34] rounded-xl px-5 py-3 text-sm" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-white/70">Agent denkt na…</span>
              </div>
            </div>
          )}

          {!agentProp && (
            <div className="flex items-center justify-center h-full text-white/60">
              <span>No agent selected. Please select an agent to start chatting.</span>
            </div>
          )}
        </div>

        {/* Input - Fixed at bottom */}
        <div className="flex-shrink-0 p-3 lg:p-4 border-t border-[#1d1f25]/80 bg-gradient-to-t from-[#111319] to-[#0f1115] backdrop-blur-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={agentProp ? "Type your message..." : "Select an agent to chat..."}
            className="w-full resize-none bg-[#15171c]/80 text-white border border-[#2a2d34]/60 rounded-xl px-3 lg:px-4 py-2.5 text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50 placeholder:text-gray-500 transition-all"
            disabled={!agentProp}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || !agentInstance}
            className="mt-2 lg:mt-3 w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Send
          </button>
        </div>
      </div>

      {/* File Operation Sidebar - Full width on mobile, fixed width on desktop */}
      <Panel 
        title="File Operations" 
        mode="width" 
        railSize={44} 
        className="w-full lg:w-96 flex-none min-w-0 flex flex-col lg:max-h-full"
      >
        <FileOperationsPanel agent={(agentProp as any) as any} />
      </Panel>
    </div>
  );
};

// Utility functions

const parseFileMessage = (content: string): Partial<FileMessage> => {
  const match = content.match(/(?:✅\\s*)?(\\w+)_file(?: complete)?\\s*'(.+?)'/i);
  if (!match) return {};
  return {
    operation: match[1].toLowerCase(),
    filePath: match[2],
  };
};
