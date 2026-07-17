import { useEffect, useState, type FormEvent } from "react";
import ValorantPanel from "./valorant/ValorantPanel";
import { validateLobbyCode } from "../services/lobbyClient";
import {
  doesCodeMatchSlug,
  normalizeLobbyCode,
} from "../../shared/lobbySlug";

type LobbyCodeEntryModalProps = {
  slug: string;
  open: boolean;
  onSuccess: (code: string) => void;
  onBackHome: () => void;
};

export default function LobbyCodeEntryModal({
  slug,
  open,
  onSuccess,
  onBackHome,
}: LobbyCodeEntryModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeLobbyCode(code);
    if (normalized.length < 4) {
      setError("Enter a valid join code.");
      return;
    }

    if (!doesCodeMatchSlug(normalized, slug)) {
      setError("That code does not match this lobby link.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await validateLobbyCode(normalized);
      onSuccess(normalized);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Lobby not found. Check the join code."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="launcher-help-backdrop animate-fadeIn"
      role="presentation"
    >
      <div
        className="launcher-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-code-entry-title"
      >
        <ValorantPanel accent="cyan">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400">
              Join lobby
            </p>
            <h2
              id="lobby-code-entry-title"
              className="mt-2 text-xl font-bold text-white"
            >
              Enter lobby code to join
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              This link does not include the join code. Enter the 6-character
              code shared by the host.
            </p>

            <label className="mt-5 block text-sm font-medium text-zinc-300" htmlFor="lobby-code-entry">
              Lobby code
            </label>
            <input
              id="lobby-code-entry"
              value={code}
              onChange={(event) => {
                setCode(
                  event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                );
                setError(null);
              }}
              maxLength={6}
              placeholder="ABC123"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error}
              className="launcher-input mt-2 w-full px-4 py-3 font-mono text-lg tracking-[0.3em]"
            />

            {error && (
              <p className="mt-2 text-sm text-red-300" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={code.trim().length < 4 || submitting}
              className="launcher-join-button mt-5 w-full px-8 py-3 font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Checking..." : "Continue"}
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="mt-3 w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white"
            >
              Back to home
            </button>
          </form>
        </ValorantPanel>
      </div>
    </div>
  );
}
