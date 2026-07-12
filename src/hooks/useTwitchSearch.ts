import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { findFirstEmptySlotIndex } from "../components/lobby/lobbyPlayerUtils";
import type { Player } from "../types/Player";
import type { TwitchSearchResult } from "../types/twitch";
import { fetchTwitchAvatar } from "../services/twitchAvatar";
import {
  getTwitchAuthMode,
  getTwitchMisconfigurationHint,
  hasTwitchClientId,
  isTwitchSearchConfigured,
  searchTwitchUsers,
} from "../services/twitchApi";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RECENT_SEARCHES_STORAGE_KEY = "valorush.twitchRecentSearches";
const MAX_RECENT_SEARCHES = 8;

function loadRecentSearches(): TwitchSearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as TwitchSearchResult[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry) =>
        typeof entry?.login === "string" &&
        typeof entry?.displayName === "string" &&
        typeof entry?.id === "string"
    );
  } catch {
    return [];
  }
}

function saveRecentSearches(entries: TwitchSearchResult[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota or private-mode storage errors.
  }
}

type UseTwitchSearchOptions = {
  players: Player[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  maxPlayers: number;
};

export function useTwitchSearch({
  players,
  setPlayers,
  maxPlayers,
}: UseTwitchSearchOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<TwitchSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<TwitchSearchResult[]>(
    () => loadRecentSearches()
  );

  const requestIdRef = useRef(0);
  const searchConfigured = isTwitchSearchConfigured();
  const clientIdConfigured = hasTwitchClientId();
  const authMode = getTwitchAuthMode();
  const misconfigurationHint = getTwitchMisconfigurationHint();

  const slotsAvailable = maxPlayers - players.length;

  const rememberRecentSearch = useCallback((user: TwitchSearchResult) => {
    setRecentSearches((current) => {
      const next = [
        user,
        ...current.filter((entry) => entry.login !== user.login),
      ].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (!searchConfigured || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const matches = await searchTwitchUsers(trimmed);
          if (requestId !== requestIdRef.current) return;
          setResults(matches);
          setIsDropdownOpen(true);
        } catch (searchError) {
          if (requestId !== requestIdRef.current) return;
          console.error(searchError);
          setResults([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Could not search Twitch."
          );
        } finally {
          if (requestId === requestIdRef.current) {
            setIsSearching(false);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [searchConfigured, searchQuery]);

  const addTwitchUser = useCallback(
    async (user: TwitchSearchResult) => {
      if (slotsAvailable <= 0) {
        setError("All player slots are filled.");
        return;
      }

      const login = user.login.toLowerCase();
      if (
        players.some((player) => player.name.toLowerCase() === login)
      ) {
        setError(`${user.displayName} is already in the lobby.`);
        return;
      }

      setIsAdding(true);
      setError(null);

      try {
        let avatar = user.avatarUrl;
        if (!avatar) {
          avatar = await fetchTwitchAvatar(login);
        }

        setPlayers((current) => {
          const slotIndex = findFirstEmptySlotIndex(current);
          if (slotIndex == null) return current;

          return [
            ...current,
            {
              id: Date.now(),
              slotIndex,
              name: user.displayName,
              avatar,
              twitchLogin: login,
              twitchId: user.id,
              twitchImportedName: user.displayName,
            },
          ];
        });

        rememberRecentSearch(user);
        setSearchQuery("");
        setResults([]);
        setIsDropdownOpen(false);
      } catch (addError) {
        console.error(addError);
        setError("Could not add that Twitch user.");
      } finally {
        setIsAdding(false);
      }
    },
    [players, rememberRecentSearch, setPlayers, slotsAvailable]
  );

  const openDropdown = useCallback(() => {
    setIsDropdownOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    results,
    isSearching,
    isAdding,
    error,
    slotsAvailable,
    searchConfigured,
    clientIdConfigured,
    authMode,
    misconfigurationHint,
    isDropdownOpen,
    setIsDropdownOpen,
    recentSearches,
    addTwitchUser,
    openDropdown,
    closeDropdown,
  };
}
