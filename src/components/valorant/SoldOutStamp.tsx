export default function SoldOutStamp() {
  return (
    <div className="sold-out-wrap pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-3">
      <div className="animate-soldOutStamp sold-out-badge" aria-hidden>
        <span className="sold-out-badge-text block text-center text-base font-black uppercase tracking-[0.18em] text-white md:text-lg">
          Sold Out
        </span>
        <span className="mt-0.5 block text-center text-[8px] font-bold uppercase tracking-[0.36em] text-white/95">
          Purchased
        </span>
      </div>
    </div>
  );
}
