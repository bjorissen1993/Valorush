import { useRef, type Dispatch, SetStateAction } from "react";
import type { Player } from "../types/Player";
import type { TwitchSearchResult } from "../types/twitch";
import { useTwitchSearch } from "../hooks/useTwitchSearch";
import TwitchBadge from "./lobby/TwitchBadge";

type TwitchImportPanelProps = {
  players: Player[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  maxPlayers: number;
  variant?: "panel" | "hotbar";
};

function TwitchResultButton({
  result,
  canAdd,
  avatarClassName,
  onSelect,
}: {
  result: TwitchSearchResult;
  canAdd: boolean;
  avatarClassName: string;
  onSelect: (result: TwitchSearchResult) => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void onSelect(result)}
      disabled={!canAdd}
      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <img
        src={
          result.avatarUrl ??
          `https://unavatar.io/twitch/${encodeURIComponent(result.login)}`
        }
        alt={result.displayName}
        className={`rounded-full border border-purple-500/30 object-cover ${avatarClassName}`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {result.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">@{result.login}</p>
      </div>
    </button>
  );
}

export default function TwitchImportPanel({
  players,
  setPlayers,
  maxPlayers,
  variant = "panel",
}: TwitchImportPanelProps) {
  const twitch = useTwitchSearch({ players, setPlayers, maxPlayers });
  const containerRef = useRef<HTMLDivElement>(null);
  const isHotbar = variant === "hotbar";

  const canAdd = twitch.slotsAvailable > 0 && !twitch.isAdding;
  const trimmedQuery = twitch.searchQuery.trim();
  const hasActiveQuery = trimmedQuery.length >= 2;
  const showRecentSearches =
    twitch.recentSearches.length > 0 &&
    (!hasActiveQuery || (!twitch.isSearching && twitch.results.length === 0));
  const showDropdown =
    twitch.searchConfigured &&
    twitch.isDropdownOpen &&
    (showRecentSearches || hasActiveQuery);

  const handleInputBlur = () => {
    requestAnimationFrame(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        twitch.closeDropdown();
      }
    });
  };

  const handleInputOpen = () => {
    twitch.openDropdown();
  };

  const configWarning =
    twitch.misconfigurationHint ||
    (!twitch.searchConfigured && !twitch.misconfigurationHint ? "not-configured" : null);

  if (isHotbar) {
    return (
      <div
        ref={containerRef}
        className="flex min-w-[180px] flex-1 items-center gap-2 sm:min-w-[220px] lg:max-w-sm"
      >
        <span className="hidden shrink-0 text-purple-400 sm:block">
          <TwitchBadge className="h-4 w-4" />
        </span>

        <div className="relative min-w-0 flex-1">
          <input
            value={twitch.searchQuery}
            onChange={(event) => {
              twitch.setSearchQuery(event.target.value);
              twitch.openDropdown();
            }}
            onMouseDown={handleInputOpen}
            onFocus={handleInputOpen}
            onBlur={handleInputBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter" && twitch.results[0] && canAdd) {
                event.preventDefault();
                void twitch.addTwitchUser(twitch.results[0]);
              }
              if (event.key === "Escape") {
                twitch.closeDropdown();
              }
            }}
            placeholder={
              twitch.searchConfigured
                ? "Search Twitch..."
                : "Twitch API not configured"
            }
            disabled={!twitch.searchConfigured || !canAdd}
            title={
              configWarning === "not-configured"
                ? "Add VITE_TWITCH_CLIENT_ID to .env.local"
                : twitch.misconfigurationHint ?? undefined
            }
            className={`w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-purple-400/40 disabled:cursor-not-allowed disabled:opacity-50 ${
              showDropdown ? "rounded-b-none border-b-0" : ""
            }`}
          />

          {showDropdown && (
            <div className="absolute left-0 top-full z-30 w-full overflow-hidden rounded-b-xl border border-white/10 bg-zinc-950 shadow-xl">
              {showRecentSearches ? (
                <>
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Recent searches
                  </p>
                  <ul className="valorant-scrollbar max-h-48 overflow-y-auto py-1">
                    {twitch.recentSearches.map((result) => (
                      <li key={`recent-${result.login}`}>
                        <TwitchResultButton
                          result={result}
                          canAdd={canAdd}
                          avatarClassName="h-8 w-8"
                          onSelect={twitch.addTwitchUser}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ) : twitch.isSearching ? (
                <p className="px-3 py-2.5 text-sm text-zinc-400">Searching...</p>
              ) : twitch.results.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-zinc-500">No accounts found.</p>
              ) : (
                <ul className="valorant-scrollbar max-h-48 overflow-y-auto py-1">
                  {twitch.results.map((result) => (
                    <li key={result.id}>
                      <TwitchResultButton
                        result={result}
                        canAdd={canAdd}
                        avatarClassName="h-8 w-8"
                        onSelect={twitch.addTwitchUser}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {twitch.error && (
            <span className="absolute left-0 top-full z-30 mt-1 max-w-xs rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs text-red-300">
              {twitch.error}
            </span>
          )}
        </div>

        {twitch.isAdding && (
          <span className="shrink-0 text-xs text-zinc-500">Adding...</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">Search Twitch</h3>
          {twitch.searchConfigured && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                twitch.authMode === "auto"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-sky-500/15 text-sky-300"
              }`}
            >
              {twitch.authMode === "auto" ? "Auto token" : "Manual token"}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Find any Twitch account and add them as a player.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {twitch.misconfigurationHint && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            <p>{twitch.misconfigurationHint}</p>
          </div>
        )}

        {configWarning === "not-configured" && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            {!twitch.clientIdConfigured ? (
              <p>
                Add <code className="text-amber-50">VITE_TWITCH_CLIENT_ID</code>{" "}
                and either{" "}
                <code className="text-amber-50">VITE_TWITCH_CLIENT_SECRET</code>{" "}
                (recommended for dev) or{" "}
                <code className="text-amber-50">VITE_TWITCH_ACCESS_TOKEN</code> to{" "}
                <code className="text-amber-50">.env.local</code>, then restart{" "}
                <code className="text-amber-50">npm run dev</code>.
              </p>
            ) : (
              <p>
                Client ID is set. Add{" "}
                <code className="text-amber-50">VITE_TWITCH_CLIENT_SECRET</code>{" "}
                for automatic tokens during dev, or paste a generated{" "}
                <code className="text-amber-50">VITE_TWITCH_ACCESS_TOKEN</code>{" "}
                (not the client secret).
              </p>
            )}
          </div>
        )}

        <div ref={containerRef} className="relative">
          <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
            Twitch username
          </label>
          <input
            value={twitch.searchQuery}
            onChange={(event) => {
              twitch.setSearchQuery(event.target.value);
              twitch.openDropdown();
            }}
            onMouseDown={handleInputOpen}
            onFocus={handleInputOpen}
            onBlur={handleInputBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter" && twitch.results[0] && canAdd) {
                event.preventDefault();
                void twitch.addTwitchUser(twitch.results[0]);
              }
              if (event.key === "Escape") {
                twitch.closeDropdown();
              }
            }}
            placeholder={
              twitch.searchConfigured
                ? "Search by login or display name..."
                : "Configure API keys to search"
            }
            disabled={!twitch.searchConfigured || !canAdd}
            className={`w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none transition focus:border-purple-400/40 disabled:cursor-not-allowed disabled:opacity-50 ${
              showDropdown ? "rounded-b-none border-b-0" : ""
            }`}
          />

          {showDropdown && (
            <div className="absolute left-0 top-full z-20 w-full overflow-hidden rounded-b-xl border border-white/10 bg-zinc-950 shadow-xl">
              {showRecentSearches ? (
                <>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Recent searches
                  </p>
                  <ul className="valorant-scrollbar max-h-52 overflow-y-auto py-1">
                    {twitch.recentSearches.map((result) => (
                      <li key={`recent-${result.login}`}>
                        <TwitchResultButton
                          result={result}
                          canAdd={canAdd}
                          avatarClassName="h-9 w-9"
                          onSelect={twitch.addTwitchUser}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ) : twitch.isSearching ? (
                <p className="px-3 py-3 text-sm text-zinc-400">Searching...</p>
              ) : twitch.results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-zinc-500">
                  No Twitch accounts found.
                </p>
              ) : (
                <ul className="valorant-scrollbar max-h-52 overflow-y-auto py-1">
                  {twitch.results.map((result) => (
                    <li key={result.id}>
                      <TwitchResultButton
                        result={result}
                        canAdd={canAdd}
                        avatarClassName="h-9 w-9"
                        onSelect={twitch.addTwitchUser}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {twitch.isAdding && (
          <p className="text-xs text-zinc-500">Adding player...</p>
        )}

        {twitch.error && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-sm text-red-300">
            {twitch.error}
          </div>
        )}

        {twitch.searchConfigured && (
          <p className="text-xs text-zinc-500">
            Type at least 2 characters. Results update as you type. Click a
            result or press Enter to add the top match.
          </p>
        )}
      </div>
    </div>
  );
}
