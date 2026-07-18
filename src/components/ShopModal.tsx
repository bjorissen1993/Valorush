import { Fragment, useMemo } from "react";
import type { PlayerInGame } from "../types/Game";
import { SHOP_TILE_DISCOUNT, getShopLocationLabel } from "../game/systems/shopSystem";
import { agentBackgroundPath } from "../game/assetPaths";
import {
  getShopkeeperDialogue,
  getShopkeeperPosition,
} from "../game/shopDialogue";
import { StoryArtPanel } from "./StoryArtPanel";
import ShopSpeechBubble from "./valorant/ShopSpeechBubble";

export type ShopOffer = {
  id: string;
  type: "weapon" | "shield" | "utility" | "ultimate";
  label: string;
  price: number;
  description?: string;
  weaponName?: string;
  /** Which loadout slot a weapon fills. */
  weaponSlot?: "primary" | "secondary";
  image?: string;
  disabled?: boolean;
};

type ShopKeeper = {
  name: string;
  image: string;
};

type ShopModalProps = {
  player: PlayerInGame;
  playerAgentName: string;
  shopKeeper: ShopKeeper | null;
  shopOffers: ShopOffer[];
  pendingPurchase: ShopOffer | null;
  onCancelPurchase: () => void;
  onConfirmPurchase: (offer: ShopOffer) => void;
  onContinue: () => void;
  renderOfferButton: (offer: ShopOffer) => React.ReactNode;
  purchasePreview?: React.ReactNode;
};

export default function ShopModal({
  player,
  playerAgentName,
  shopKeeper,
  shopOffers,
  pendingPurchase,
  onCancelPurchase,
  onConfirmPurchase,
  onContinue,
  renderOfferButton,
  purchasePreview,
}: ShopModalProps) {
  const keeperName = shopKeeper?.name ?? "Shopkeeper";
  const dialogue = useMemo(
    () =>
      shopKeeper ? getShopkeeperDialogue(keeperName, playerAgentName) : null,
    [shopKeeper, keeperName, playerAgentName]
  );

  const shopkeeperPosition = getShopkeeperPosition(keeperName);

  const shopLocationLabel = getShopLocationLabel(keeperName);

  const sidearmOffers = shopOffers.filter(
    (o) =>
      o.weaponSlot === "secondary" ||
      o.description === "Sidearm" ||
      o.description === "Secondary"
  );
  const primaryOffers = shopOffers.filter(
    (o) => o.weaponSlot === "primary" || o.description === "Primary"
  );
  const shieldOffers = shopOffers.filter((o) => o.type === "shield");
  const offerRowCount = Math.max(
    sidearmOffers.length,
    primaryOffers.length,
    shieldOffers.length,
    1
  );

  return (
    <div className="fixed inset-0 z-[75] flex animate-fadeIn items-center justify-center overflow-visible bg-black/65 p-4 pt-24 pl-8 md:pl-16">
      <div className="relative grid w-full max-w-6xl overflow-visible shadow-2xl md:grid-cols-[minmax(300px,360px)_1fr] md:grid-rows-[auto_min(760px,88vh)]">
        {dialogue && (
          <div className="relative z-40 mb-3 w-full min-w-0 shrink-0 md:col-start-2 md:row-start-1">
            <ShopSpeechBubble
              speaker={dialogue.speaker}
              text={dialogue.text}
              accent={dialogue.accent}
            />
          </div>
        )}

        {shopKeeper && (
          <div className="relative z-20 hidden h-full min-h-0 overflow-visible md:col-start-1 md:row-start-2 md:block">
            <StoryArtPanel
              agentName={shopKeeper.name}
              imageSrc={shopKeeper.image}
              roleLabel="Shopkeeper"
              backgroundImage={agentBackgroundPath(shopKeeper.name)}
              glowClass="from-emerald-500/10"
              popOut
              popOutShiftX={shopkeeperPosition.shiftXPercent}
              popOutShiftXPx={shopkeeperPosition.shiftXPx ?? 0}
              popOutShiftY={shopkeeperPosition.shiftYPercent ?? 0}
            />
          </div>
        )}

        <div className="relative z-10 flex min-h-[min(760px,88vh)] min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] md:col-start-2 md:row-start-2 md:rounded-l-none md:border-l-0">
          <div className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
            <div className="relative z-30 shrink-0">
              <p className="text-right text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
                {shopLocationLabel}
              </p>
              <div className="mt-8 flex flex-wrap items-start justify-between gap-4 md:mt-10">
                <div>
                  <h2 className="text-3xl font-bold text-white md:text-4xl">
                    Arm up for the next round
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    <span className="font-semibold text-white">{playerAgentName}</span>{" "}
                    landed on a shop tile.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      Creds
                    </p>
                    <p className="mt-1 text-lg font-bold text-white">{player.creds}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/70">
                      Tile Discount
                    </p>
                    <p className="mt-1 text-lg font-bold text-emerald-300">
                      -{SHOP_TILE_DISCOUNT}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <div
                className="grid min-h-0 flex-1 gap-x-4 gap-y-3 md:grid-cols-3"
                style={{
                  gridTemplateRows: `auto repeat(${offerRowCount}, minmax(0, 1fr))`,
                }}
              >
                <p className="shrink-0 text-sm font-semibold text-white">Sidearms</p>
                <p className="shrink-0 text-sm font-semibold text-white">
                  Primary Weapons
                </p>
                <p className="shrink-0 text-sm font-semibold text-white">Shields</p>

                {Array.from({ length: offerRowCount }, (_, rowIndex) => (
                  <Fragment key={rowIndex}>
                    <div className="min-h-0 overflow-visible">
                      {sidearmOffers[rowIndex] ? (
                        <div className="h-full min-h-0 overflow-visible">
                          {renderOfferButton(sidearmOffers[rowIndex])}
                        </div>
                      ) : null}
                    </div>
                    <div className="min-h-0 overflow-visible">
                      {primaryOffers[rowIndex] ? (
                        <div className="h-full min-h-0 overflow-visible">
                          {renderOfferButton(primaryOffers[rowIndex])}
                        </div>
                      ) : null}
                    </div>
                    <div className="min-h-0 overflow-visible">
                      {shieldOffers[rowIndex] ? (
                        <div className="h-full min-h-0 overflow-visible">
                          {renderOfferButton(shieldOffers[rowIndex])}
                        </div>
                      ) : null}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="mt-4 shrink-0 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={onContinue}
                className="w-full rounded-2xl bg-emerald-400 py-3 font-bold text-black transition hover:brightness-110 md:float-right md:w-auto md:px-8"
              >
                Continue
              </button>
            </div>
          </div>

          {pendingPurchase && purchasePreview && (
            <div className="absolute inset-0 z-30 flex animate-fadeIn items-center justify-center bg-[#0b1020]/92 p-6 md:p-8">
              <div className="shop-purchase-panel mx-auto flex w-full max-w-lg flex-col items-center px-8 py-10 text-center shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
                {purchasePreview}
                <div className="mt-8 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={onCancelPurchase}
                    className="rounded-2xl border border-white/10 bg-black/20 px-6 py-3 font-bold text-white transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirmPurchase(pendingPurchase)}
                    className="rounded-2xl bg-emerald-400 px-8 py-3 font-bold text-black transition hover:brightness-110"
                  >
                    Buy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
