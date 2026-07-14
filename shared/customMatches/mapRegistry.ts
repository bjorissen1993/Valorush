import type { ValorantMapId } from "./types";

/** Which Valorant custom-game pool a map belongs to. */
export type MapPoolId = "competitive" | "arOS" | "retake" | "tdm" | "skirmish";

export type MapDefinition = {
  id: ValorantMapId;
  /** Filename under `public/maps/` (without directory prefix). */
  splashFile: string | null;
  pools: MapPoolId[];
};

/** All known Valorant maps grouped by official custom-game pools. */
export const MAP_POOLS: Record<MapPoolId, readonly ValorantMapId[]> = {
  competitive: [
    "Abyss",
    "Ascent",
    "Bind",
    "Breeze",
    "Corrode",
    "Fracture",
    "Haven",
    "Icebox",
    "Lotus",
    "Pearl",
    "Split",
    "Summit",
    "Sunset",
  ],
  arOS: [
    "Abyss",
    "Ascent",
    "Breeze",
    "District",
    "Icebox",
    "Pearl",
    "Split",
    "Sunset",
  ],
  retake: ["Ascent", "Bind", "Haven", "Summit", "Sunset"],
  tdm: ["District", "Drift", "Glitch", "Kasbah", "Piazza"],
  skirmish: [
    "Skirmish A",
    "Skirmish B",
    "Skirmish C",
    "Skirmish D",
    "Skirmish E",
  ],
};

/**
 * Local splash assets shipped in `public/maps/`.
 * Maps without `splashFile` are excluded from random picks until an image is added.
 */
export const MAP_DEFINITIONS: MapDefinition[] = [
  { id: "Abyss", splashFile: "Loading_Screen_Abyss.png", pools: ["competitive", "arOS"] },
  { id: "Ascent", splashFile: "Loading_Screen_Ascent.png", pools: ["competitive", "arOS", "retake"] },
  { id: "Bind", splashFile: "Loading_Screen_Bind.png", pools: ["competitive", "retake"] },
  { id: "Breeze", splashFile: "Loading_Screen_Breeze.png", pools: ["competitive", "arOS"] },
  { id: "Corrode", splashFile: "Loading_Screen_Corrode.png", pools: ["competitive"] },
  { id: "District", splashFile: "District_Splash.png", pools: ["arOS", "tdm"] },
  { id: "Drift", splashFile: "Drift_Splash.png", pools: ["tdm"] },
  { id: "Fracture", splashFile: "Loading_Screen_Fracture.png", pools: ["competitive"] },
  { id: "Glitch", splashFile: "Glitch_Splash.png", pools: ["tdm"] },
  { id: "Haven", splashFile: "Loading_Screen_Haven.png", pools: ["competitive", "retake"] },
  { id: "Icebox", splashFile: "Loading_Screen_Icebox.png", pools: ["competitive", "arOS"] },
  { id: "Kasbah", splashFile: "Kasbah_Splash.png", pools: ["tdm"] },
  { id: "Lotus", splashFile: "Loading_Screen_Lotus.png", pools: ["competitive"] },
  { id: "Pearl", splashFile: "Loading_Screen_Pearl.png", pools: ["competitive", "arOS"] },
  { id: "Piazza", splashFile: "Piazza_Splash.png", pools: ["tdm"] },
  { id: "Split", splashFile: "Loading_Screen_Split.png", pools: ["competitive", "arOS"] },
  { id: "Summit", splashFile: "Loading_Screen_Summit.png", pools: ["competitive", "retake"] },
  { id: "Sunset", splashFile: "Loading_Screen_Sunset.png", pools: ["competitive", "arOS", "retake"] },
  { id: "Skirmish A", splashFile: "Skirmish_Splash.png", pools: ["skirmish"] },
  { id: "Skirmish B", splashFile: "Skirmish_Splash.png", pools: ["skirmish"] },
  { id: "Skirmish C", splashFile: "Skirmish_Splash.png", pools: ["skirmish"] },
  { id: "Skirmish D", splashFile: "Skirmish_Splash.png", pools: ["skirmish"] },
  { id: "Skirmish E", splashFile: "Skirmish_Splash.png", pools: ["skirmish"] },
];

export const mapDefinitionById = new Map(
  MAP_DEFINITIONS.map((entry) => [entry.id, entry])
);

export function mapHasSplashAsset(mapId: ValorantMapId): boolean {
  return mapDefinitionById.get(mapId)?.splashFile != null;
}

/** Resolve `/maps/...` path for a map splash. Falls back to Ascent loading screen. */
export function getMapSplashPath(mapId: ValorantMapId): string {
  const file = mapDefinitionById.get(mapId)?.splashFile;
  if (file) return `/maps/${file}`;
  return "/maps/Loading_Screen_Ascent.png";
}

/** Maps in a pool that have a local splash asset (safe for UI + random picks). */
export function mapsInPoolWithAssets(pool: MapPoolId): ValorantMapId[] {
  return MAP_POOLS[pool].filter((id) => mapHasSplashAsset(id));
}

/** Competitive maps with splash assets only. */
export function competitiveMapsWithAssets(): ValorantMapId[] {
  return mapsInPoolWithAssets("competitive");
}

export function pickRandomMapFromPool(pool: MapPoolId): ValorantMapId {
  const eligible = mapsInPoolWithAssets(pool);
  if (eligible.length === 0) return "Ascent";
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function pickRandomFromMaps(maps: ValorantMapId[]): ValorantMapId {
  const eligible = maps.filter((id) => mapHasSplashAsset(id));
  if (eligible.length === 0) return "Ascent";
  return eligible[Math.floor(Math.random() * eligible.length)];
}
