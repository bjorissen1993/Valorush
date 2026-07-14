import { useEffect, useRef, useState } from "react";
import {
  CUSTOM_MATCH_CATEGORY_LABELS,
  getCustomMatchDefinition,
} from "../../shared/customMatches";
import type { CustomMatchCategory } from "../../shared/customMatches/types";
import { pointsIconPath } from "../game/assetPaths";

type MatchFormatPresentationProps = {
  matchId: string;
  onComplete: () => void;
};

type FormatPhase = "enter" | "pulse" | "hold";

export const FORMAT_REVEAL_ENTER_MS = 700;
export const FORMAT_REVEAL_PULSE_MS = 900;
export const FORMAT_REVEAL_HOLD_MS = 800;

export const FORMAT_REVEAL_TOTAL_MS =
  FORMAT_REVEAL_ENTER_MS + FORMAT_REVEAL_PULSE_MS + FORMAT_REVEAL_HOLD_MS;

const FORMAT_HEADLINES: Record<CustomMatchCategory, string> = {
  free_for_all: "FREE FOR ALL",
  "2v2": "2v2 TEAMS",
  "1v3": "1 ATTACKER · 3 DEFENDERS",
};

const FORMAT_TAGLINES: Record<CustomMatchCategory, string> = {
  free_for_all: "Every operative for themselves — chaotic eliminations.",
  "2v2": "Two squads. One winner. Split and execute.",
  "1v3": "One pushes the site. Three hold the line.",
};

export default function MatchFormatPresentation({
  matchId,
  onComplete,
}: MatchFormatPresentationProps) {
  const [phase, setPhase] = useState<FormatPhase>("enter");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const match = getCustomMatchDefinition(matchId);
  const category = match?.category ?? "free_for_all";
  const categoryLabel = CUSTOM_MATCH_CATEGORY_LABELS[category];

  useEffect(() => {
    setPhase("enter");

    const pulseTimer = window.setTimeout(
      () => setPhase("pulse"),
      FORMAT_REVEAL_ENTER_MS
    );
    const holdTimer = window.setTimeout(
      () => setPhase("hold"),
      FORMAT_REVEAL_ENTER_MS + FORMAT_REVEAL_PULSE_MS
    );
    const completeTimer = window.setTimeout(
      () => onCompleteRef.current(),
      FORMAT_REVEAL_TOTAL_MS
    );

    return () => {
      window.clearTimeout(pulseTimer);
      window.clearTimeout(holdTimer);
      window.clearTimeout(completeTimer);
    };
  }, [matchId]);

  return (
    <div className="fixed inset-0 z-[84] flex flex-col items-center justify-center bg-black/94 p-4">
      <div className="map-reveal-backdrop pointer-events-none absolute inset-0" />

      <div className="relative z-10 mb-6 flex items-center gap-2">
        <img src={pointsIconPath("kingdom")} alt="" className="h-7 w-7 opacity-90" />
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300/80">
          Match Format
        </p>
      </div>

      <div
        className={[
          "match-format-stage relative z-10 w-full max-w-3xl",
          phase === "enter" ? "match-format-stage--enter" : "",
          phase === "pulse" ? "match-format-stage--pulse" : "",
          phase === "hold" ? "match-format-stage--hold" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="match-format-tablet overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#060a14]/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <div className="border-b border-cyan-400/15 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 px-6 py-3">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/70">
              {match?.name ?? "Custom Match"}
            </p>
          </div>

          <div className="px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-200 ring-1 ring-violet-400/30">
                {categoryLabel}
              </span>
              {match?.playerFormat && (
                <span className="rounded-full bg-zinc-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-300 ring-1 ring-zinc-400/20">
                  {match.playerFormat}
                </span>
              )}
            </div>

            <h2 className="match-format-headline mt-5 text-center text-3xl font-black uppercase tracking-[0.12em] text-white md:text-5xl">
              {FORMAT_HEADLINES[category]}
            </h2>
            <p className="mt-3 text-center text-sm text-zinc-400 md:text-base">
              {FORMAT_TAGLINES[category]}
            </p>

            <div className="mt-8">
              {category === "free_for_all" && <FreeForAllVisual active={phase !== "enter"} />}
              {category === "2v2" && <TwoVTwoVisual active={phase !== "enter"} />}
              {category === "1v3" && <OneVThreeVisual active={phase !== "enter"} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FreeForAllVisual({ active }: { active: boolean }) {
  const slots = ["nw", "ne", "sw", "se", "c"];
  return (
    <div className="match-format-ffa relative mx-auto h-40 max-w-md">
      {slots.map((slot, index) => (
        <span
          key={slot}
          className={[
            "match-format-ffa__node",
            `match-format-ffa__node--${slot}`,
            active ? "match-format-ffa__node--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
      <div className="match-format-ffa__burst" aria-hidden="true" />
    </div>
  );
}

function TwoVTwoVisual({ active }: { active: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      {(["Alpha", "Bravo"] as const).map((team, teamIndex) => (
        <div
          key={team}
          className={[
            "match-format-team rounded-xl border px-4 py-5",
            teamIndex === 0
              ? "border-cyan-400/30 bg-cyan-500/5"
              : "border-orange-400/30 bg-orange-500/5",
            active ? "match-format-team--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <p
            className={[
              "text-center text-[10px] font-bold uppercase tracking-[0.24em]",
              teamIndex === 0 ? "text-cyan-300" : "text-orange-300",
            ].join(" ")}
          >
            Team {team}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {[0, 1].map((slot) => (
              <span
                key={slot}
                className={[
                  "match-format-team__slot",
                  teamIndex === 0
                    ? "match-format-team__slot--cyan"
                    : "match-format-team__slot--orange",
                  active ? "match-format-team__slot--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ animationDelay: `${teamIndex * 120 + slot * 80}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OneVThreeVisual({ active }: { active: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3 md:gap-5">
      <div
        className={[
          "match-format-side rounded-xl border border-red-400/35 bg-red-500/5 px-3 py-6",
          active ? "match-format-side--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-red-300">
          Attacker
        </p>
        <div className="mt-4 flex justify-center">
          <span
            className={[
              "match-format-side__solo match-format-side__solo--attacker",
              active ? "match-format-side__solo--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
      </div>

      <div
        className={[
          "match-format-side rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-6",
          active ? "match-format-side--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
          Defenders
        </p>
        <div className="mt-4 flex justify-center gap-2 md:gap-3">
          {[0, 1, 2].map((slot) => (
            <span
              key={slot}
              className={[
                "match-format-side__solo match-format-side__solo--defender",
                active ? "match-format-side__solo--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ animationDelay: `${slot * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
