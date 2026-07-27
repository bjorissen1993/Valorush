# ValoRush Expansion (Board / Economy / Ultimates)

## Shipped in this expansion

| Phase | Status | Notes |
|-------|--------|-------|
| **A — Board** | Done | ~55-tile rectangular outer loop + central hub cross (Paint sketch); START NW spur; clockwise outer flow; planar mid roads; branching via exit multiplicity; `boardValidator` checks **both** mid-road modes; legacy position remap |
| **A1 — Mid roads / doors / portals** | Done | Button toggles Mode A (`vertical_in`) ↔ Mode B (`horizontal_in`); doors sync (open pair = inward axis); portals BL↔TR cost **400 creds**; shared `midRoadMode` in online snapshot |
| **A2 — Tile types** | Done | Credits/normal (+300/+400/+500), Event, Shop, Lucky, Ult Orb, Minigame, Spike, Risk, Tactical/Special, **Portal**, **Button**; landing handlers in `landingSystem` / `GamePage` |
| **A3 — Camera + minimap** | Done | Match-start overview (landmarks → START), smooth follow + dynamic cluster zoom, drag-to-pan + wheel zoom (manual overrides follow, soft re-follow after idle), event pan (spike/shop), board-event pulse, permanent minimap with click-to-navigate |
| **B — Circular tiles + stacking** | Done | Smaller circular tiles color-coded by type; `getPlayerTokenPosition` fans 1–4 tokens on bottom arc; large distinct START |
| **C — Normal tiles + economy** | Done | Weighted credit roll 300/400/500; `stealCredits` helper; shared jackpot; `RADIANITE_BUY_COST = 3000`; portal warp = 400 |
| **D — Two dice** | Done | Default 2d6; `computeFinalMovement = max(0, rolled + bonuses − debuffs)` |
| **E — Shop revision** | Done | Rotating shop (dice, agent dice, ult orb, Odin, Operator, defuse items, backpack, dice holder); Lucky Backpack shop reroll; Dice Holder store/reuse |
| **F — Ultimate reworks** | Done | Priority agents playable; Cypher match-config modal; Sova 3-shot re-aim; free-cursor area placement; Chamber loot wheel UI |

### Mid-road modes (button toggle)

- **Mode A (`vertical_in`)**: N/S paths flow **inward**, E/W paths flow **outward**. Vertical doors open; horizontal doors closed.
- **Mode B (`horizontal_in`)**: E/W inward, N/S outward. Horizontal doors open; vertical doors closed.
- Hub always keeps an exit (never both axes inward). Buttons flip mode for **everyone** (synced via `midRoadMode`).

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
- `src/components/PortalTileModal.tsx`
- `src/expansion.test.ts`

## Remaining / deferred

- [ ] Brimstone big orbital VFX pass
- [ ] Phoenix/Sage reactive prompt modal polish (green theme for Sage)
- [ ] Online: sync `killjoyDevices` / `slowZones` / `areaNodeIds` on `use_ultimate` actions
- [ ] Spike item integration polish for Advanced Defuse Kit / Defuse Drone in defuse modal
- [ ] Online sync for Lucky choice / jackpot (camera is local-visual; board rewards still apply locally)

## Save / migration

- Legacy node ids (`top-split`, `right-merge`, …) remap via `migrateBoardPosition`
- Prior mid/inner / asymmetric ids remap onto rectangular-cross ids (`ot*`, `mn*`, `hub`, …)
- Legacy `split`/`merge` tile types → `normal`
- `BoardUltimateState` normalized for missing `killjoyDevices` / `slowZones` / poison `activationId`
- Invalid saved positions fall back to `start`
- `midRoadMode` defaults to `vertical_in` when missing from older snapshots

## Architecture reference

```
getNodeExits(id, midRoadMode)  → directed movement graph (static next + active midEdges)
button tile                    → toggleMidRoadMode (sync midRoadMode)
portal tile                    → pay PORTAL_CREDIT_COST (400) to warp BL↔TR
boardValidator                 → both modes reachable + visual non-crossing
economy.stealCredits           → intended vs actual
diceSystem.computeFinalMovement
ultimates/areaTargeting        → free-cursor circle ∩ tile
ultimates/negativeEffects      → reactive Phoenix/Sage
ChamberLootWheel               → Tour de Force presentation after apply
BoardCameraViewport            → overview / follow / event / pulse / manual pan
BoardMinimap                   → permanent overlay + click-to-navigate
```
