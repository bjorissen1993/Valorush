# ValoRush Expansion (Board / Economy / Ultimates)

## Shipped in this expansion

| Phase | Status | Notes |
|-------|--------|-------|
| **A — Board** | Done | ~58-tile asymmetric planar network (NW approach spur + organic circuit + irregular mid corridors + SE-offset plaza); regional pacing Safe→Prep→Danger→Recovery→Crossroads→Chaos; branching via `next.length > 1` only; no `split`/`merge` types; route-choice pause mid-move; `boardValidator` (connectivity + visual non-crossing); legacy position remap |
| **A2 — Tile types** | Done | Credits/normal (+300/+400/+500), Event, Shop, Lucky (player choice), Ult Orb (+1), Minigame, Spike, Risk (mild setbacks + jackpot), Tactical/Special (+1 move); landing handlers in `landingSystem` / `GamePage` |
| **A3 — Camera + minimap** | Done | Match-start overview (landmarks → START), smooth follow + dynamic cluster zoom, drag-to-pan + wheel zoom (manual overrides follow, soft re-follow after idle), event pan (spike/shop), board-event pulse, permanent minimap with click-to-navigate |
| **B — Circular tiles + stacking** | Done | Smaller circular tiles color-coded by type; `getPlayerTokenPosition` fans 1–4 tokens on bottom arc; large distinct START |
| **C — Normal tiles + economy** | Done | Weighted credit roll 300/400/500; `stealCredits` helper; shared jackpot; `RADIANITE_BUY_COST = 3000` |
| **D — Two dice** | Done | Default 2d6; `computeFinalMovement = max(0, rolled + bonuses − debuffs)` |
| **E — Shop revision** | Done | Rotating shop (dice, agent dice, ult orb, Odin, Operator, defuse items, backpack, dice holder); Lucky Backpack shop reroll; Dice Holder store/reuse |
| **F — Ultimate reworks** | Done | Priority agents playable; Cypher match-config modal; Sova 3-shot re-aim; free-cursor area placement; Chamber loot wheel UI |

### Ultimate reworks landed

- **Brimstone** — free-cursor area circle, partial tiles count, credit drain, no knockback, immune
- **Omen** — teleport any tile, no land activate, end turn immediately
- **Viper** — free-cursor placement-radius area, 1-round zone, −2 move once per `activationId`, immune
- **Killjoy** — free-cursor device with radius, detonates at start of KJ’s next turn, −2 once
- **Chamber** — slow zone + weighted loot wheel UI (steal clamps / 3000 fallback)
- **Deadlock** — pull to Deadlock tile, no land activate, reactive hook
- **Phoenix / Sage** — reactive ultimate arm + rollback pipeline (`negativeEffects.ts`)
- **Sova** — 3-shot re-aim loop with shot counter banner
- **Cypher** — match-config modal (matchup/teams/mode/weapons/agents/modifiers)

### New modules

- `src/game/boardValidator.ts`
- `src/game/economy.ts`
- `src/game/diceSystem.ts`
- `src/game/tokenLayout.ts`
- `src/game/ultimates/areaTargeting.ts`
- `src/game/ultimates/negativeEffects.ts`
- `src/components/ChamberLootWheel.tsx`
- `src/components/BoardCameraViewport.tsx`
- `src/components/LuckyTileModal.tsx`
- `src/expansion.test.ts`

## Remaining / deferred

- [ ] Brimstone big orbital VFX pass
- [ ] Phoenix/Sage reactive prompt modal polish (green theme for Sage)
- [ ] Online: sync `killjoyDevices` / `slowZones` / `areaNodeIds` on `use_ultimate` actions
- [ ] Spike item integration polish for Advanced Defuse Kit / Defuse Drone in defuse modal
- [ ] Online sync for Lucky choice / jackpot (camera is local-visual; board rewards still apply locally)

## Save / migration

- Legacy node ids (`top-split`, `right-merge`, …) remap via `migrateBoardPosition`
- Prior mid/inner ids (`m-top-*`, `inner-ne`, …) remap onto `m*` / `i*` rings
- Legacy `split`/`merge` tile types → `normal`
- `BoardUltimateState` normalized for missing `killjoyDevices` / `slowZones` / poison `activationId`
- Invalid saved positions fall back to `start`

## Architecture reference

```
boardLayout.next.length > 1  → route choice (not a tile type)
boardValidator visual_crossing → non-adjacent edges must not cross
economy.stealCredits         → intended vs actual
diceSystem.computeFinalMovement
ultimates/areaTargeting      → free-cursor circle ∩ tile
ultimates/negativeEffects    → reactive Phoenix/Sage
ChamberLootWheel             → Tour de Force presentation after apply
BoardCameraViewport          → overview / follow / event / pulse / manual pan
BoardMinimap                 → permanent overlay + click-to-navigate
```
