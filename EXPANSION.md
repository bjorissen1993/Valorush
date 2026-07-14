# ValoRush Expansion Roadmap (Phase 2+)

Phase 1 delivered the architecture and playable foundations below. This document tracks what remains.

## Completed in Phase 1

| Area | Path | Status |
|------|------|--------|
| Event registry | `shared/events/` | 18 choice-based events across 6 categories |
| Custom matches | `shared/customMatches/` | 7 match types + map reveal UI |
| Items | `shared/items/` | 8 items (4 board + 4 spike defuse) |
| Minigames | `shared/minigames/` | Neon Race, Cypher Seek, Quick Roll (stub play) |
| Duel tiles | — | **Removed** — replaced by events/minigames/custom matches |
| Spike defuse | `src/game/systems/spikeSystem.ts` | 2-dice + difficulty + item hooks |
| Director wiring | `shared/director/` | Agent/Kingdom bindings updated |

## Phase 2 — Items & Shop

- [ ] Sell agent/weapon items in `ShopModal` from `shared/items/registry.ts`
- [ ] Black market tile/event hook for `ghost-steal` and contraband items
- [ ] Use items from inventory during movement (`jett-dice`, `knife-swap`, `operator-scope`)
- [ ] Item earn paths from minigame/custom match rewards
- [ ] Sync `items[]` fully in online snapshots (partial — field exists on `SyncedPlayerInGame`)

## Phase 3 — Minigames (full play)

- [ ] **Neon Race** — timed lane dodge stub → dedicated UI with Sunset map backdrop
- [ ] **Cypher Seek** — hidden node pick / deduction instead of dice roll
- [ ] Minigame picker when board tile or custom match triggers `playMode: "full"`
- [ ] Register new minigames by adding one entry to `shared/minigames/registry.ts` only

## Phase 4 — Custom Matches (full play)

- [ ] Per-mode rules: Spike Rush plants, TDM elimination bracket, Escalation weapon tiers
- [ ] Sheriff Duel / Operator Only / Knife Fight — target pick + roll modifiers
- [ ] Pistol Round eco bonuses applied to board state after match
- [ ] Host-authoritative custom match phase in `OnlineGameSnapshot`
- [ ] Post-match standings animation

## Phase 5 — Events polish

- [ ] Multi-step event UI polish (Deadlock target pick, Fade paranoia flow)
- [ ] Agent-specific event weighting when trigger player's agent matches `sourceAgent`
- [ ] Kingdom protocol events force `presentation: "briefing"` consistently

## Phase 6 — Spike & board

- [ ] Owl Drone true preview (show dice before commit, hide without item)
- [ ] Stim Beacon reroll UX (re-roll button, consume item)
- [ ] Spike difficulty scaling by round / planter agent
- [ ] Defuse sync for online guests (currently host-local spike state)

## Phase 7 — Online sync hardening

- [ ] Sync `scheduledCustomMatch`, `pendingEventChoice`, `activeSpike`, `customMatchPhase`
- [ ] Remote actions for event choices and defuse choices
- [ ] Snapshot version bumps on movement modifiers tick

## Architecture reference

```
shared/
  events/          — BoardEventDefinition + applyEffect + playerChoices
  customMatches/   — Match types, maps, rewards
  items/           — Collectible/buyable items
  minigames/       — Register-only minigame defs
  director/        — Agent + Kingdom narration bindings
```

## Adding a new board event

1. Add `BoardEventDefinition` to `shared/events/registry.ts`
2. Bind agent in `shared/director/agentRegistry.ts` (optional)
3. No GamePage changes required if using existing choice kinds
