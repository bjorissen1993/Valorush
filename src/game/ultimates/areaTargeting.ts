/**
 * Area targeting helpers — free cursor circles with tile intersection.
 * Partially hit tiles count as fully hit.
 */

import { boardLayout, type BoardNode } from "../boardLayout";

export type BoardPoint = { x: number; y: number };

/** Approximate tile radius in layout-space units (matches circular board tiles). */
export const DEFAULT_TILE_RADIUS = 2.8;

export type AreaCircle = {
  center: BoardPoint;
  /** Radius in the same coordinate space as boardLayout x/y. */
  radius: number;
};

export function distance(a: BoardPoint, b: BoardPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Circle–circle intersection: area overlaps tile if centers are within rArea + rTile. */
export function circleIntersectsTile(
  area: AreaCircle,
  tile: BoardNode,
  tileRadius = DEFAULT_TILE_RADIUS
): boolean {
  return distance(area.center, { x: tile.x, y: tile.y }) <= area.radius + tileRadius;
}

/** All tiles partially or fully inside the area circle. */
export function tilesInArea(
  area: AreaCircle,
  tileRadius = DEFAULT_TILE_RADIUS,
  nodes: BoardNode[] = boardLayout
): BoardNode[] {
  return nodes.filter((node) => circleIntersectsTile(area, node, tileRadius));
}

export function tileIdsInArea(
  area: AreaCircle,
  tileRadius = DEFAULT_TILE_RADIUS,
  nodes: BoardNode[] = boardLayout
): string[] {
  return tilesInArea(area, tileRadius, nodes).map((n) => n.id);
}

/** Placement radius constrained around an owner tile (Viper / Killjoy). */
export function clampCenterToPlacementRadius(
  desired: BoardPoint,
  ownerTile: BoardNode,
  placementRadius: number
): BoardPoint {
  const d = distance(desired, { x: ownerTile.x, y: ownerTile.y });
  if (d <= placementRadius || d === 0) return desired;
  const t = placementRadius / d;
  return {
    x: ownerTile.x + (desired.x - ownerTile.x) * t,
    y: ownerTile.y + (desired.y - ownerTile.y) * t,
  };
}

/** Configurable area radii (layout units). */
export const AREA_RADIUS = {
  brimstone: 12,
  viper: 8,
  killjoy: 14,
} as const;

export const PLACEMENT_RADIUS = {
  /** Max distance from Viper's tile to place the pit center. */
  viper: 18,
  /** Max distance from Killjoy's tile to place the device. */
  killjoy: 22,
} as const;
