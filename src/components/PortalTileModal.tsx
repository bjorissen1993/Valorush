import { PORTAL_CREDIT_COST } from "../game/economy";

type Props = {
  playerName: string;
  credits: number;
  cost?: number;
  onUse: () => void;
  onSkip: () => void;
};

export default function PortalTileModal({
  playerName,
  credits,
  cost = PORTAL_CREDIT_COST,
  onUse,
  onSkip,
}: Props) {
  const canAfford = credits >= cost;

  return (
    <div className="portal-tile-overlay" role="dialog" aria-label="Portal tile">
      <div className="portal-tile-modal">
        <p className="portal-tile-modal__eyebrow">Portal</p>
        <h2 className="portal-tile-modal__title">{playerName} — warp?</h2>
        <p className="portal-tile-modal__subtitle">
          Pay <strong>{cost} credits</strong> to teleport to the other portal
          (opposite corner). You have {credits} creds.
        </p>
        <div className="portal-tile-modal__actions">
          <button
            type="button"
            className="portal-tile-modal__btn portal-tile-modal__btn--use"
            disabled={!canAfford}
            onClick={onUse}
          >
            {canAfford ? `Teleport (−${cost})` : `Need ${cost} creds`}
          </button>
          <button
            type="button"
            className="portal-tile-modal__btn portal-tile-modal__btn--skip"
            onClick={onSkip}
          >
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
