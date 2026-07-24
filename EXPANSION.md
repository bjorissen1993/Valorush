# ValoRush Expansion (Board / Economy / Ultimates)

## Shipped in this expansion

| Phase | Status | Notes |
|-------|--------|-------|
| **A — Board** | Done | ~50-tile network; branching via `next.length > 1` only; no `split`/`merge` types; route-choice pause mid-move; `boardValidator` (dev); legacy position remap |
| **B — Circular tiles + stacking** | Done | Smaller circular tiles; `getPlayerTokenPosition` fans 1–4 tokens on bottom arc |
| **C — Normal tiles + economy** | Done | Weighted credit roll; `stealCredits` helper; `RADIANITE_BUY_COST = 3000` |
| **D — Two dice** | Done | Default 2d6; `computeFinalMovement = max(0, rolled + bonuses − debuffs)` |
| **E — Shop revision** | Done | Rotating shop (dice, agent dice, ult orb, Odin, Operator, defuse items, backpack, dice holder); no normal weapon catalog; no teleports |
| **F — Ultimate reworks** | Partial | Priority agents reworked (see below); full Cypher match-config UI + Sova 3-shot UX still thin |

### Ultimate reworks landed

- **Brimstone** — area circle, partial tiles count, credit drain, no knockback, immune
- **Omen** — teleport any tile, no land activate, end turn immediately
- **Viper** — placement-radius area, 1-round zone, −2 move once per `activationId`, immune
- **Killjoy** — device with radius, detonates at start of KJ’s next turn, −2 once
- **Chamber** — slow zone + weighted loot wheel with steal clamps / 3000 fallback
- **Deadlock** — pull to Deadlock tile, no land activate, reactive hook
- **Phoenix / Sage** — reactive ultimate arm + rollback pipeline (`negativeEffects.ts`)
- **Sova** — multi-shot apply path (3 shots); UI re-aim loop still basic (tile click)
- **Cypher** — match-config payload on apply; dedicated configurator modal deferred

### New modules

- `src/game/boardValidator.ts`
- `src/game/economy.ts`
- `src/game/diceSystem.ts`
- `src/game/tokenLayout.ts`
- `src/game/ultimates/areaTargeting.ts`
- `src/game/ultimates/negativeEffects.ts`
- `src/expansion.test.ts`

## Remaining / deferred

- [ ] Cypher match configurator modal (matchup/teams/mode/weapons/agents/modifiers UI)
- [ ] Sova full 3-shot re-aim UX (progress bar + force continue targeting after each shot)
- [ ] Free-cursor area placement (pixel cursor) — currently tile-click approximates center
- [ ] Brimstone big orbital VFX pass
- [ ] Chamber Tour de Force + loot wheel presentation UI
- [ ] Phoenix/Sage reactive prompt modal polish (green theme for Sage)
- [ ] Online: sync `killjoyDevices` / `slowZones` / `areaNodeIds` on `use_ultimate` actions
- [ ] Shop: Lucky Backpack reroll + Dice Holder store/reuse flows
- [ ] Spike item integration polish for Advanced Defuse Kit / Defuse Drone in defuse modal

## Save / migration

- Legacy node ids (`top-split`, `right-merge`, …) remap via `migrateBoardPosition`
- Legacy `split`/`merge` tile types → `normal`
- `BoardUltimateState` normalized for missing `killjoyDevices` / `slowZones` / poison `activationId`
- Invalid saved positions fall back to `start`

## Architecture reference

```
boardLayout.next.length > 1  → route choice (not a tile type)
economy.stealCredits         → intended vs actual
diceSystem.computeFinalMovement
ultimates/areaTargeting      → circle ∩ tile
ultimates/negativeEffects    → reactive Phoenix/Sage
```
