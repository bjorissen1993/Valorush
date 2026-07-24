/**
 * Fan player tokens around the bottom arc of a circular tile.
 * Offsets are percentages of the tile box (0–100), relative to tile center.
 */

export type TokenPosition = {
  /** Horizontal offset from tile center (% of tile width). */
  offsetXPercent: number;
  /** Vertical offset from tile center (% of tile height). Positive = down. */
  offsetYPercent: number;
};

/**
 * @param _tile unused (reserved for future per-tile radius tweaks)
 * @param indexOnTile 0-based index among players on this tile
 * @param total total players stacked on the tile (1–4 typical)
 */
export function getPlayerTokenPosition(
  _tile: { id: string; x: number; y: number } | null | undefined,
  indexOnTile: number,
  total: number
): TokenPosition {
  const count = Math.max(1, Math.min(4, total));
  const index = Math.max(0, Math.min(count - 1, indexOnTile));

  if (count === 1) {
    return { offsetXPercent: 0, offsetYPercent: 18 };
  }

  // Fan along a bottom semicircle (angles from ~210° to ~330°, CSS y-down).
  const startDeg = 210;
  const endDeg = 330;
  const t = count === 1 ? 0.5 : index / (count - 1);
  const deg = startDeg + (endDeg - startDeg) * t;
  const rad = (deg * Math.PI) / 180;
  const radius = count <= 2 ? 28 : 32;

  return {
    offsetXPercent: Math.cos(rad) * radius,
    // Bias downward so stacked tokens sit on the lower half of the circle.
    offsetYPercent: Math.abs(Math.sin(rad)) * radius * 0.9 + 10,
  };
}
