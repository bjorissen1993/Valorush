# ValoRush Expansion Roadmap (Phase 2+)

Phase 1 delivered the architecture and playable foundations below. This document tracks what remains.

## Completed in Phase 1

| Area | Path | Status |
|------|------|--------|
| Event registry | `shared/events/` | 20 choice-based events across 6 categories |
| Custom matches | `shared/customMatches/` | 9 Valorant modes + map registry + category UI |
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
- [ ] Standard / Retake / All Random One Site — 1v3 site hold flow
- [ ] Skirmish 2v2 bracket and map-specific arenas (A–E)
- [ ] Host-authoritative custom match phase in `OnlineGameSnapshot`
- [ ] Post-match standings animation

## Map & mode reference

Valorant ships **9 custom-game modes**. ValoRush groups them into three categories for board scheduling:

| Category | Modes | Player format |
|----------|-------|---------------|
| **Free for All** | Deathmatch, Escalation | FFA |
| **2v2** | Spike Rush, Team Deathmatch, Skirmish | 2v2 |
| **1v3** | Standard, Retake, All Random One Site, Swiftplay | 1 attacker vs 3 defenders |

Registry: `shared/customMatches/registry.ts` · Map pools: `shared/customMatches/mapRegistry.ts`

### Map pools & local assets

Map splashes live in `public/maps/` and are **not** auto-fetched (unlike agent portraits from the Valorant API). Add images manually from the Valorant wiki or Riot CDN.

| Pool | Maps | Asset pattern |
|------|------|---------------|
| Competitive | Abyss, Ascent, Bind, Breeze, Corrode, Fracture, Haven, Icebox, Lotus, Pearl, Split, Summit, Sunset | `Loading_Screen_{Map}.png` |
| All Random One Site | Abyss, Ascent, Breeze, District, Icebox, Pearl, Split, Sunset | Loading screen or `{Map}_Splash.png` |
| Retake | Ascent, Bind, Haven, Summit, Sunset | `Loading_Screen_{Map}.png` |
| Team Deathmatch | District, Drift, Glitch, Kasbah, Piazza | `{Map}_Splash.png` |
| Skirmish | Skirmish A–E | `Skirmish_Splash.png` (shared until per-arena art added) |

**Maps with assets today:** Abyss, Ascent, Bind, Breeze, District, Drift, Fracture, Glitch, Haven, Icebox, Kasbah, Lotus, Pearl, Piazza, Split, Sunset, Skirmish (A–E share one splash).

**Missing assets (excluded from random picks):** Corrode, Summit.

### Adding Summit (or Corrode)

1. Obtain a loading-screen splash (e.g. from [Valorant wiki](https://valorant.fandom.com/wiki/Summit) or Riot media).
2. Save as `public/maps/Loading_Screen_Summit.png` (match existing competitive maps like `Loading_Screen_Ascent.png`).
3. In `shared/customMatches/mapRegistry.ts`, set Summit's `splashFile` to `"Loading_Screen_Summit.png"` (currently `null`).
4. Redeploy — Summit enters competitive and retake random pools automatically.

Gamemode icons (optional UI): `public/gamemodes/` — Deathmatch, Escalation, Skirmish, Spike_Rush, Plant_Defuse_Mode.


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
  customMatches/   — Match types, map pools, rewards
  items/           — Collectible/buyable items
  minigames/       — Register-only minigame defs
  director/        — Agent + Kingdom narration bindings
```

## Adding a new board event

1. Add `BoardEventDefinition` to `shared/events/registry.ts`
2. Bind agent in `shared/director/agentRegistry.ts` (optional)
3. No GamePage changes required if using existing choice kinds
