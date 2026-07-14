import { useEffect, useRef, useState } from "react";

type LobbyPlayerHostMenuProps = {
  onMakeHost: () => void;
  onKick: () => void;
};

export default function LobbyPlayerHostMenu({
  onMakeHost,
  onKick,
}: LobbyPlayerHostMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-2 z-30 sm:right-3 sm:top-3"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg p-1.5 text-zinc-500 opacity-0 transition-opacity duration-75 ease-out hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100 data-[open=true]:opacity-100"
        data-open={open}
        title="Player options"
        aria-label="Player options"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 14a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/98 py-1 shadow-2xl backdrop-blur-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onMakeHost();
            }}
            className="flex w-full px-3 py-2 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/5"
          >
            Make host
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onKick();
            }}
            className="flex w-full px-3 py-2 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10"
          >
            Kick from lobby
          </button>
        </div>
      )}
    </div>
  );
}
