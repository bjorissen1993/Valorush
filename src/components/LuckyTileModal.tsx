import type { LuckyChoiceId } from "../game/systems/landingSystem";
import { LUCKY_CHOICE_OPTIONS } from "../game/systems/landingSystem";

type Props = {
  playerName: string;
  onChoose: (choice: LuckyChoiceId) => void;
};

export default function LuckyTileModal({ playerName, onChoose }: Props) {
  return (
    <div className="lucky-tile-overlay" role="dialog" aria-label="Lucky tile">
      <div className="lucky-tile-modal">
        <p className="lucky-tile-modal__eyebrow">Lucky Space</p>
        <h2 className="lucky-tile-modal__title">{playerName}, pick a reward</h2>
        <p className="lucky-tile-modal__subtitle">
          One choice — credits, power, or a free item.
        </p>
        <div className="lucky-tile-modal__grid">
          {LUCKY_CHOICE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="lucky-tile-modal__choice"
              onClick={() => onChoose(opt.id)}
            >
              <span className="lucky-tile-modal__choice-label">{opt.label}</span>
              <span className="lucky-tile-modal__choice-desc">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
