import { agentBackgroundPath } from "../../game/assetPaths";

type ShopkeeperPopoutProps = {
  name: string;
  image: string;
};

/** Absolutely positioned left of the shop panel — does not affect panel layout. */
export default function ShopkeeperPopout({ name, image }: ShopkeeperPopoutProps) {
  const backgroundImage = agentBackgroundPath(name);

  return (
    <>
      <div className="pointer-events-none absolute -bottom-[2%] -left-[min(290px,34%)] z-30 hidden md:block">
        <div
          className="relative"
          style={{
            transform: "translateY(-11%) rotateY(-5deg)",
            transformOrigin: "bottom center",
          }}
        >
          <img
            src={backgroundImage}
            alt=""
            className="pointer-events-none absolute bottom-[8%] left-1/2 h-64 w-64 -translate-x-1/2 object-cover opacity-20 blur-sm"
          />
          <img
            src={image}
            alt={name}
            className="relative h-[min(88vh,800px)] w-auto max-w-none object-contain object-bottom drop-shadow-[0_36px_80px_rgba(0,0,0,0.75)]"
          />
        </div>

        <div className="absolute bottom-[14%] left-[58%] z-10 h-11 w-40 -translate-x-1/2 rounded-full bg-black/55 blur-2xl" />

        <div className="absolute bottom-[10%] left-[52%] z-20 -translate-x-1/2 whitespace-nowrap text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-400/80">
            Shopkeeper
          </p>
          <p className="mt-0.5 text-xl font-black uppercase tracking-wide text-white">
            {name}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-2 -left-16 z-30 md:hidden">
        <img
          src={image}
          alt={name}
          className="h-56 w-auto max-w-none object-contain object-bottom drop-shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
        />
      </div>
    </>
  );
}
