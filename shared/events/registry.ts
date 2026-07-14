import type {
  BoardEventDefinition,
  EventApplyContext,
  EventApplyResult,
  PlayerBoardState,
} from "./types";
import { pickRandomMapForMatch } from "../customMatches/registry";
import { assertEventEligibleAgent, isEventEligibleAgent } from "../availableAgents";

const MAP = (name: string) => `/maps/Loading_Screen_${name}.png`;

function clonePlayers(players: PlayerBoardState[]): PlayerBoardState[] {
  return players.map((p) => ({ ...p, items: [...p.items] }));
}

function updateAt(
  players: PlayerBoardState[],
  index: number,
  updater: (p: PlayerBoardState) => PlayerBoardState
): PlayerBoardState[] {
  return players.map((p, i) => (i === index ? updater(p) : p));
}

function pickRandomNode(ctx: EventApplyContext, exclude?: string): string {
  const ids =
    ctx.boardNodeIds?.filter(
      (id) => id !== "start" && id !== exclude && !id.includes("split") && !id.includes("merge")
    ) ?? ["start"];
  return ids[Math.floor(Math.random() * ids.length)] ?? "start";
}

function scheduleMatch(
  ctx: EventApplyContext,
  matchId: string,
  headline: string,
  description: string,
  mood: EventApplyResult["outcomeMood"] = "neutral"
): EventApplyResult {
  const mapId = pickRandomMapForMatch(matchId);
  return {
    players: clonePlayers(ctx.players),
    outcomeHeadline: headline,
    outcomeDescription: description,
    outcomeMood: mood,
    scheduleCustomMatch: {
      matchId,
      mapId,
      announcedRound: ctx.currentRound ?? 1,
    },
  };
}

/** Board event definitions — add new events here only. */
export const boardEventRegistry: BoardEventDefinition[] = [
  // ── Teleport ──────────────────────────────────────────────────────────
  {
    id: "yoru-rift",
    name: "Yoru's Rift",
    description: "A dimensional tear opens — take the rift or stay grounded.",
    category: "teleport",
    sourceAgent: "Yoru",
    weight: "common",
    story: {
      headline: "Yoru tears open Bind",
      paragraphs: [
        "A rift flickers on the board — one path leads somewhere else entirely.",
        "\"Take it or don't. I don't care either way.\"",
      ],
      narrator: "Yoru",
      narratorRole: "Dimensional Agent",
      backgroundImage: MAP("Bind"),
      mood: "mysterious",
      tag: "Rift",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "take-rift", label: "Take the Rift", description: "Random teleport to another tile." },
        { id: "stay", label: "Stay Put", description: "Keep position, gain 50 creds for caution." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "stay") {
        players[idx] = { ...players[idx], creds: players[idx].creds + 50 };
        return {
          players,
          outcomeHeadline: "Rift ignored",
          outcomeDescription: "You held position and collected 50 creds.",
          outcomeMood: "positive",
          flatEffect: { type: "creds", amount: 50 },
        };
      }
      const dest = pickRandomNode(ctx, players[idx].position);
      players[idx] = { ...players[idx], position: dest };
      return {
        players,
        outcomeHeadline: "Rift taken",
        outcomeDescription: `Yoru's rift flung you to ${dest}.`,
        outcomeMood: "neutral",
      };
    },
  },
  {
    id: "omen-shadows",
    name: "Omen's Shadows",
    description: "Omen offers a shadow swap — pick who you trade places with.",
    category: "teleport",
    sourceAgent: "Omen",
    weight: "rare",
    story: {
      headline: "From the smoke, Omen speaks",
      paragraphs: [
        "Dark smoke rolls across Haven. A hooded figure points at the board.",
        "\"Pick someone. Trade places. The shadows don't care who blinks first.\"",
      ],
      narrator: "Omen",
      narratorRole: "Shadow Agent",
      backgroundImage: MAP("Haven"),
      mood: "mysterious",
      tag: "Shadow",
    },
    playerChoices: { kind: "pick_player", excludeSelf: true, label: "Swap positions with" },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const a = ctx.triggerPlayerIndex;
      const b = ctx.targetPlayerIndex ?? 0;
      if (b < 0 || b >= players.length || b === a) {
        return {
          players,
          outcomeHeadline: "Shadow fizzles",
          outcomeDescription: "No valid target — nothing happens.",
          outcomeMood: "neutral",
        };
      }
      const posA = players[a].position;
      const posB = players[b].position;
      players[a] = { ...players[a], position: posB };
      players[b] = { ...players[b], position: posA };
      return {
        players,
        outcomeHeadline: "Shadow swap",
        outcomeDescription: `${players[a].name} and ${players[b].name} traded positions.`,
        outcomeMood: "neutral",
      };
    },
  },
  {
    id: "astra-cosmic-divide",
    name: "Cosmic Divide",
    description: "Astra splits the board — accept a cosmic jump or hold your lane.",
    category: "teleport",
    sourceAgent: "Astra",
    weight: "epic",
    story: {
      headline: "Stars align on Abyss",
      paragraphs: [
        "Astra's stars mark two points on the board.",
        "\"Jump to the cosmic lane, or stay and take the stipend. Your call.\"",
      ],
      narrator: "Astra",
      narratorRole: "Astral Guardian",
      backgroundImage: MAP("Abyss"),
      mood: "mysterious",
      tag: "Cosmic",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "cosmic-jump", label: "Cosmic Jump", description: "Teleport to a random tile." },
        { id: "hold-lane", label: "Hold Lane", description: "+1 Radianite for staying." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "hold-lane") {
        players[idx] = {
          ...players[idx],
          radianitePoints: players[idx].radianitePoints + 1,
        };
        return {
          players,
          outcomeHeadline: "Lane held",
          outcomeDescription: "Astra nods — +1 Radianite.",
          outcomeMood: "positive",
          flatEffect: { type: "radianite", amount: 1 },
        };
      }
      const dest = pickRandomNode(ctx, players[idx].position);
      players[idx] = { ...players[idx], position: dest };
      return {
        players,
        outcomeHeadline: "Cosmic jump",
        outcomeDescription: `Stars carry you to ${dest}.`,
        outcomeMood: "neutral",
      };
    },
  },

  // ── Movement ──────────────────────────────────────────────────────────
  {
    id: "neon-rush",
    name: "Neon Rush",
    description: "Neon overcharges your legs — +2 movement for 3 turns.",
    category: "movement",
    sourceAgent: "Neon",
    weight: "common",
    story: {
      headline: "Neon sparks the circuit",
      paragraphs: [
        "Neon slides you a charged battery on Sunset yard.",
        "\"Three turns of overdrive. Don't waste my watts.\"",
      ],
      narrator: "Neon",
      narratorRole: "Duelist",
      backgroundImage: MAP("Sunset"),
      mood: "positive",
      tag: "Speed",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "accept", label: "Accept Overdrive", description: "+2 steps for 3 turns." },
        { id: "decline", label: "Decline", description: "Keep normal pace, gain 75 creds." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "decline") {
        players[idx] = { ...players[idx], creds: players[idx].creds + 75 };
        return {
          players,
          outcomeHeadline: "Overdrive declined",
          outcomeDescription: "Neon shrugs — +75 creds instead.",
          outcomeMood: "positive",
          flatEffect: { type: "creds", amount: 75 },
        };
      }
      players[idx] = {
        ...players[idx],
        movementBonus: 2,
        movementBonusTurns: 3,
      };
      return {
        players,
        outcomeHeadline: "Neon Rush active",
        outcomeDescription: "+2 movement for your next 3 turns.",
        outcomeMood: "positive",
      };
    },
  },
  {
    id: "deadlock-lockdown",
    name: "Killjoy Lockdown",
    description: "Killjoy's nanoswarm limits movement — max 2 steps for 2 turns.",
    category: "movement",
    sourceAgent: "Killjoy",
    weight: "common",
    story: {
      headline: "Barrier deployed",
      paragraphs: [
        "Killjoy's nanoswarm snaps shut on the board.",
        "\"Two steps max. Two turns. Consider it… motivation.\"",
      ],
      narrator: "Killjoy",
      narratorRole: "Sentinel",
      backgroundImage: MAP("Lotus"),
      mood: "negative",
      tag: "Lockdown",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "self", label: "Trap Yourself", description: "Max 2 steps for 2 turns." },
        { id: "target", label: "Trap a Rival", description: "Pick a player to lock down instead." },
      ],
    },
    applyEffect(ctx) {
      if (ctx.choiceId === "target") {
        return {
          players: clonePlayers(ctx.players),
          outcomeHeadline: "Pick your target",
          outcomeDescription: "Select a player to lock down (max 2 steps, 2 turns).",
          outcomeMood: "neutral",
        };
      }
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      players[idx] = {
        ...players[idx],
        maxStepsPerTurn: 2,
        maxStepsTurns: 2,
      };
      return {
        players,
        outcomeHeadline: "Lockdown active",
        outcomeDescription: "Max 2 steps per turn for 2 turns.",
        outcomeMood: "negative",
      };
    },
  },
  {
    id: "deadlock-lockdown-target",
    name: "Killjoy Lockdown",
    description: "Trap a rival with Killjoy's barrier.",
    category: "movement",
    sourceAgent: "Killjoy",
    weight: "common",
    story: {
      headline: "Barrier deployed",
      paragraphs: ["Killjoy points at your rival.", "\"They walk slower now.\""],
      narrator: "Killjoy",
      narratorRole: "Sentinel",
      backgroundImage: MAP("Lotus"),
      mood: "negative",
      tag: "Lockdown",
    },
    playerChoices: { kind: "pick_player", excludeSelf: true, label: "Lock down" },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const target = ctx.targetPlayerIndex ?? ctx.triggerPlayerIndex;
      return {
        players: updateAt(players, target, (p) => ({
          ...p,
          maxStepsPerTurn: 2,
          maxStepsTurns: 2,
        })),
        outcomeHeadline: "Rival locked down",
        outcomeDescription: `${players[target].name} — max 2 steps for 2 turns.`,
        outcomeMood: "negative",
      };
    },
  },
  {
    id: "skye-trail-boost",
    name: "Guiding Light",
    description: "Skye's creature marks a faster path — +1 step for 2 turns.",
    category: "movement",
    sourceAgent: "Skye",
    weight: "rare",
    story: {
      headline: "Trailblazer picks up a scent",
      paragraphs: [
        "Skye's creature loops Lotus site twice, then chirps.",
        "\"Follow the light — extra step, two turns.\"",
      ],
      narrator: "Skye",
      narratorRole: "Initiator",
      backgroundImage: MAP("Lotus"),
      mood: "positive",
      tag: "Recovery",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "follow", label: "Follow the Light", description: "+1 step for 2 turns." },
        { id: "ignore", label: "Ignore", description: "No movement bonus." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "ignore") {
        return {
          players,
          outcomeHeadline: "Light ignored",
          outcomeDescription: "Skye's creature sulks away.",
          outcomeMood: "neutral",
        };
      }
      players[idx] = {
        ...players[idx],
        movementBonus: players[idx].movementBonus + 1,
        movementBonusTurns: Math.max(players[idx].movementBonusTurns, 2),
      };
      return {
        players,
        outcomeHeadline: "Guiding Light",
        outcomeDescription: "+1 movement for 2 turns.",
        outcomeMood: "positive",
      };
    },
  },

  // ── Economy ───────────────────────────────────────────────────────────
  {
    id: "chamber-tax",
    name: "Chamber Tax",
    description: "Chamber's invoice arrives — pay the tax or face penalties.",
    category: "economy",
    sourceAgent: "Chamber",
    weight: "common",
    story: {
      headline: "Premium logistics, premium price",
      paragraphs: [
        "A gold-trimmed manifest pings your tac screen.",
        "\"Kingdom tax due. Pay now or negotiate.\"",
      ],
      narrator: "Chamber",
      narratorRole: "Weapons Dealer",
      backgroundImage: MAP("Pearl"),
      mood: "neutral",
      tag: "Tax",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "pay", label: "Pay 150 Creds", description: "Clear the invoice cleanly." },
        { id: "refuse", label: "Refuse", description: "Lose 75 creds and next-buy +100 discount lost." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "pay") {
        players[idx] = {
          ...players[idx],
          creds: Math.max(0, players[idx].creds - 150),
        };
        return {
          players,
          outcomeHeadline: "Tax paid",
          outcomeDescription: "Chamber marks the invoice paid (-150 Creds).",
          outcomeMood: "negative",
          flatEffect: { type: "creds", amount: -150 },
        };
      }
      players[idx] = {
        ...players[idx],
        creds: Math.max(0, players[idx].creds - 75),
      };
      return {
        players,
        outcomeHeadline: "Tax refused",
        outcomeDescription: "Chamber notes the debt (-75 Creds).",
        outcomeMood: "negative",
        flatEffect: { type: "creds", amount: -75 },
      };
    },
  },
  {
    id: "clove-gamble",
    name: "Clove Gamble",
    description: "Clove bets your creds on a coin flip — choose your stake.",
    category: "economy",
    sourceAgent: "Clove",
    weight: "rare",
    story: {
      headline: "Life's a gamble",
      paragraphs: [
        "Clove grins and flips a cred chip.",
        "\"Pick your stake. Heads you win double, tails you lose it all.\"",
      ],
      narrator: "Clove",
      narratorRole: "Radiant",
      backgroundImage: MAP("Ascent"),
      mood: "neutral",
      tag: "Gamble",
    },
    playerChoices: { kind: "bet_creds", presets: [100, 200, 300], label: "Bet amount" },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      const bet = Math.min(ctx.betAmount ?? 100, players[idx].creds);
      const won = Math.random() < 0.45;
      if (won) {
        players[idx] = { ...players[idx], creds: players[idx].creds + bet };
        return {
          players,
          outcomeHeadline: "Clove pays out",
          outcomeDescription: `You won the flip (+${bet} Creds).`,
          outcomeMood: "positive",
          flatEffect: { type: "creds", amount: bet },
        };
      }
      players[idx] = { ...players[idx], creds: Math.max(0, players[idx].creds - bet) };
      return {
        players,
        outcomeHeadline: "Clove collects",
        outcomeDescription: `Wrong call (-${bet} Creds).`,
        outcomeMood: "negative",
        flatEffect: { type: "creds", amount: -bet },
      };
    },
  },
  {
    id: "killjoy-cache",
    name: "Nanobomb's Cache",
    description: "Killjoy's spare parts fund your next buy (+200 Creds).",
    category: "economy",
    sourceAgent: "Killjoy",
    weight: "common",
    story: {
      headline: "A gadget crate with your name on it",
      paragraphs: [
        "Killjoy slides a crate across the Split lab floor.",
        "\"Brimstone says we're flush. Take the creds.\"",
      ],
      narrator: "Killjoy",
      narratorRole: "Protocol Engineer",
      backgroundImage: MAP("Split"),
      mood: "positive",
      tag: "Founders",
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      players[idx] = { ...players[idx], creds: players[idx].creds + 200 };
      return {
        players,
        outcomeHeadline: "Cache opened",
        outcomeDescription: "Killjoy's crate pays out (+200 Creds).",
        outcomeMood: "positive",
        flatEffect: { type: "creds", amount: 200 },
      };
    },
  },

  // ── Player interaction ────────────────────────────────────────────────
  {
    id: "iso-challenge",
    name: "Reyna Challenge",
    description: "Reyna marks a target — steal creds if you pick wisely.",
    category: "player_interaction",
    sourceAgent: "Reyna",
    weight: "common",
    story: {
      headline: "Reyna wants a duel of wallets",
      paragraphs: [
        "Reyna's eyes flash violet under neon.",
        "\"Pick someone. If they've got less creds than you, you steal 150. Otherwise, they steal from you.\"",
      ],
      narrator: "Reyna",
      narratorRole: "Duelist",
      backgroundImage: MAP("Sunset"),
      mood: "neutral",
      tag: "Challenge",
    },
    playerChoices: { kind: "pick_player", excludeSelf: true, label: "Challenge" },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const a = ctx.triggerPlayerIndex;
      const b = ctx.targetPlayerIndex ?? 0;
      if (b < 0 || b >= players.length) {
        return {
          players,
          outcomeHeadline: "Challenge fizzled",
          outcomeDescription: "No valid target.",
          outcomeMood: "neutral",
        };
      }
      const steal = 150;
      if (players[a].creds > players[b].creds) {
        const taken = Math.min(steal, players[b].creds);
        players[b] = { ...players[b], creds: players[b].creds - taken };
        players[a] = { ...players[a], creds: players[a].creds + taken };
        return {
          players,
          outcomeHeadline: "Reyna Challenge won",
          outcomeDescription: `Stole ${taken} creds from ${players[b].name}.`,
          outcomeMood: "positive",
        };
      }
      const taken = Math.min(steal, players[a].creds);
      players[a] = { ...players[a], creds: players[a].creds - taken };
      players[b] = { ...players[b], creds: players[b].creds + taken };
      return {
        players,
        outcomeHeadline: "Reyna Challenge lost",
        outcomeDescription: `${players[b].name} stole ${taken} creds from you.`,
        outcomeMood: "negative",
      };
    },
  },
  {
    id: "breach-shockwave",
    name: "Breach Shockwave",
    description: "Breach's fault line sends a target stumbling backward.",
    category: "player_interaction",
    sourceAgent: "Breach",
    weight: "common",
    story: {
      headline: "Fault line on Fracture",
      paragraphs: [
        "Breach slams the table — the board shakes.",
        "\"Pick who eats the shockwave. They slide back three tiles.\"",
      ],
      narrator: "Breach",
      narratorRole: "Initiator",
      backgroundImage: MAP("Fracture"),
      mood: "negative",
      tag: "Shockwave",
    },
    playerChoices: { kind: "pick_player", excludeSelf: true, label: "Shockwave target" },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const target = ctx.targetPlayerIndex ?? ctx.triggerPlayerIndex;
      const nodeIds = ctx.boardNodeIds ?? ["start"];
      const currentIdx = nodeIds.indexOf(players[target].position);
      const backIdx = Math.max(0, currentIdx - 3);
      const dest = nodeIds[backIdx] ?? "start";
      players[target] = { ...players[target], position: dest };
      return {
        players,
        outcomeHeadline: "Shockwave hits",
        outcomeDescription: `${players[target].name} pushed back to ${dest}.`,
        outcomeMood: "negative",
      };
    },
  },
  {
    id: "fade-paranoia",
    name: "Omen's Paranoia",
    description: "Omen whispers from the smoke — swap 100 creds with your pick.",
    category: "player_interaction",
    sourceAgent: "Omen",
    weight: "rare",
    story: {
      headline: "Something in the dark has a name",
      paragraphs: [
        "Omen's hooded silhouette flickers at the edge of vision.",
        "\"Pick someone. You each give 100 creds to the pot — highest roll takes it. Or skip and lose 50.\"",
      ],
      narrator: "Omen",
      narratorRole: "Shadow Agent",
      backgroundImage: MAP("Pearl"),
      mood: "mysterious",
      tag: "Nightmare",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "play", label: "Play Paranoia", description: "Pick a player — 50/50 cred swap." },
        { id: "skip", label: "Skip", description: "Lose 50 creds to fear." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "skip") {
        players[idx] = { ...players[idx], creds: Math.max(0, players[idx].creds - 50) };
        return {
          players,
          outcomeHeadline: "Paranoia skipped",
          outcomeDescription: "Omen takes 50 creds for cowardice.",
          outcomeMood: "negative",
          flatEffect: { type: "creds", amount: -50 },
        };
      }
      return {
        players,
        outcomeHeadline: "Pick your nightmare",
        outcomeDescription: "Select a player for the paranoia swap.",
        outcomeMood: "neutral",
      };
    },
  },
  {
    id: "fade-paranoia-target",
    name: "Omen's Paranoia",
    description: "Complete the paranoia swap with your pick.",
    category: "player_interaction",
    sourceAgent: "Omen",
    weight: "rare",
    story: {
      headline: "Nightmare resolves",
      paragraphs: ["Omen laughs in the dark.", "\"Let's see who flinches.\""],
      narrator: "Omen",
      narratorRole: "Shadow Agent",
      backgroundImage: MAP("Pearl"),
      mood: "mysterious",
      tag: "Nightmare",
    },
    playerChoices: { kind: "pick_player", excludeSelf: true, label: "Paranoia target" },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const a = ctx.triggerPlayerIndex;
      const b = ctx.targetPlayerIndex ?? 0;
      const pot = 100;
      const aPay = Math.min(pot, players[a].creds);
      const bPay = Math.min(pot, players[b].creds);
      players[a] = { ...players[a], creds: players[a].creds - aPay };
      players[b] = { ...players[b], creds: players[b].creds - bPay };
      const winner = Math.random() < 0.5 ? a : b;
      players[winner] = {
        ...players[winner],
        creds: players[winner].creds + aPay + bPay,
      };
      return {
        players,
        outcomeHeadline: "Paranoia resolved",
        outcomeDescription: `${players[winner].name} takes the pot (${aPay + bPay} creds).`,
        outcomeMood: winner === a ? "positive" : "negative",
      };
    },
  },

  // ── Custom match scheduling ───────────────────────────────────────────
  {
    id: "kingdom-spike-rush",
    name: "Spike Rush Scheduled",
    description: "Kingdom schedules a Spike Rush at end of round.",
    category: "custom_match",
    sourceKingdom: "Kingdom Protocol",
    weight: "rare",
    story: {
      headline: "Spike Rush incoming",
      paragraphs: [
        "Kingdom comms crackle — live-fire drill authorized.",
        "\"Spike Rush scheduled when this round ends. Be ready.\"",
      ],
      narrator: "Kingdom Intel",
      narratorRole: "Protocol Brief",
      presentation: "briefing",
      backgroundImage: MAP("Bind"),
      mood: "neutral",
      tag: "Custom Match",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "accept", label: "Accept Mission", description: "Schedule Spike Rush at round end." },
        { id: "defer", label: "Request Delay", description: "Gain 100 creds, match still scheduled." },
      ],
    },
    applyEffect(ctx) {
      const base = scheduleMatch(
        ctx,
        "spike-rush",
        "Spike Rush scheduled",
        "Custom Match plays when this round completes."
      );
      if (ctx.choiceId === "defer") {
        const players = clonePlayers(ctx.players);
        const idx = ctx.triggerPlayerIndex;
        players[idx] = { ...players[idx], creds: players[idx].creds + 100 };
        return { ...base, players, flatEffect: { type: "creds", amount: 100 } };
      }
      return base;
    },
  },
  {
    id: "brimstone-tdm",
    name: "TDM Scheduled",
    description: "Brimstone calls a Team Deathmatch at round end.",
    category: "custom_match",
    sourceAgent: "Brimstone",
    weight: "common",
    story: {
      headline: "Brimstone calls TDM",
      paragraphs: [
        "Brimstone marks the sector on Ascent.",
        "\"Team Deathmatch when the round closes. Highest roll wins.\"",
      ],
      narrator: "Brimstone",
      narratorRole: "Protocol Commander",
      backgroundImage: MAP("Ascent"),
      mood: "neutral",
      tag: "Custom Match",
    },
    applyEffect(ctx) {
      return scheduleMatch(
        ctx,
        "tdm",
        "TDM scheduled",
        "Team Deathmatch at end of round."
      );
    },
  },
  {
    id: "viper-escalation",
    name: "Escalation Scheduled",
    description: "Viper's lab triggers an Escalation custom match.",
    category: "custom_match",
    sourceAgent: "Viper",
    weight: "epic",
    story: {
      headline: "Escalation protocol",
      paragraphs: [
        "Viper's toxin readout spikes on Icebox.",
        "\"Escalation match when the round ends. Don't choke.\"",
      ],
      narrator: "Viper",
      narratorRole: "Protocol Founder",
      backgroundImage: MAP("Icebox"),
      mood: "negative",
      tag: "Custom Match",
    },
    applyEffect(ctx) {
      return scheduleMatch(
        ctx,
        "escalation",
        "Escalation scheduled",
        "Weapon escalation custom match at round end."
      );
    },
  },

  // ── Map events ────────────────────────────────────────────────────────
  {
    id: "bind-teleporter",
    name: "Bind Teleporter Malfunction",
    description: "Bind teleporters glitch — random reposition or hold for creds.",
    category: "map_event",
    weight: "common",
    story: {
      headline: "Teleporter offline… mostly",
      paragraphs: [
        "Bind's teleporter sparks and spins.",
        "\"Jump random, or stay and collect hazard pay.\"",
      ],
      narrator: "Killjoy",
      narratorRole: "Engineer",
      backgroundImage: MAP("Bind"),
      mood: "neutral",
      tag: "Bind",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "jump", label: "Take Teleporter", description: "Random tile." },
        { id: "stay", label: "Stay Safe", description: "+125 creds." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "stay") {
        players[idx] = { ...players[idx], creds: players[idx].creds + 125 };
        return {
          players,
          outcomeHeadline: "Hazard pay",
          outcomeDescription: "+125 Creds for avoiding the glitch.",
          outcomeMood: "positive",
          flatEffect: { type: "creds", amount: 125 },
        };
      }
      const dest = pickRandomNode(ctx, players[idx].position);
      players[idx] = { ...players[idx], position: dest };
      return {
        players,
        outcomeHeadline: "Teleporter jump",
        outcomeDescription: `Glitch sends you to ${dest}.`,
        outcomeMood: "neutral",
      };
    },
  },
  {
    id: "ascent-zipline",
    name: "Ascent Zipline Rush",
    description: "Mid zipline shortcut — risk the rush for movement bonus.",
    category: "map_event",
    weight: "common",
    story: {
      headline: "Mid control on Ascent",
      paragraphs: [
        "Market zipline hums with activity.",
        "\"Ride the zip for +1 step next turn, or loot mid for creds.\"",
      ],
      narrator: "Jett",
      narratorRole: "Duelist",
      backgroundImage: MAP("Ascent"),
      mood: "positive",
      tag: "Ascent",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "zip", label: "Zipline Rush", description: "+1 movement next turn." },
        { id: "loot", label: "Loot Mid", description: "+150 creds." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "loot") {
        players[idx] = { ...players[idx], creds: players[idx].creds + 150 };
        return {
          players,
          outcomeHeadline: "Mid looted",
          outcomeDescription: "+150 Creds from market control.",
          outcomeMood: "positive",
          flatEffect: { type: "creds", amount: 150 },
        };
      }
      players[idx] = {
        ...players[idx],
        movementBonus: players[idx].movementBonus + 1,
        movementBonusTurns: Math.max(players[idx].movementBonusTurns, 1),
      };
      return {
        players,
        outcomeHeadline: "Zipline rush",
        outcomeDescription: "+1 movement on your next turn.",
        outcomeMood: "positive",
      };
    },
  },
  {
    id: "lotus-rotating-doors",
    name: "Lotus Rotating Doors",
    description: "Lotus doors spin — pick a path for bonus or penalty.",
    category: "map_event",
    weight: "rare",
    story: {
      headline: "Doors rotate on Lotus",
      paragraphs: [
        "Lotus A/B doors spin unpredictably — Astra's stars flicker between them.",
        "\"Red door: radianite gamble. Blue door: cred stipend.\"",
      ],
      narrator: "Astra",
      narratorRole: "Astral Guardian",
      backgroundImage: MAP("Lotus"),
      mood: "neutral",
      tag: "Lotus",
    },
    playerChoices: {
      kind: "fixed",
      options: [
        { id: "red", label: "Red Door", description: "50% +1 Radianite or -100 creds." },
        { id: "blue", label: "Blue Door", description: "Guaranteed +100 creds." },
      ],
    },
    applyEffect(ctx) {
      const players = clonePlayers(ctx.players);
      const idx = ctx.triggerPlayerIndex;
      if (ctx.choiceId === "blue") {
        players[idx] = { ...players[idx], creds: players[idx].creds + 100 };
        return {
          players,
          outcomeHeadline: "Blue door",
          outcomeDescription: "+100 Creds.",
          outcomeMood: "positive",
          flatEffect: { type: "creds", amount: 100 },
        };
      }
      const won = Math.random() < 0.5;
      if (won) {
        players[idx] = {
          ...players[idx],
          radianitePoints: players[idx].radianitePoints + 1,
        };
        return {
          players,
          outcomeHeadline: "Red door pays",
          outcomeDescription: "+1 Radianite.",
          outcomeMood: "positive",
          flatEffect: { type: "radianite", amount: 1 },
        };
      }
      players[idx] = {
        ...players[idx],
        creds: Math.max(0, players[idx].creds - 100),
      };
      return {
        players,
        outcomeHeadline: "Red door trap",
        outcomeDescription: "-100 Creds.",
        outcomeMood: "negative",
        flatEffect: { type: "creds", amount: -100 },
      };
    },
  },
];

function validateBoardEventAgents(events: BoardEventDefinition[]): void {
  for (const event of events) {
    if (event.sourceAgent) {
      assertEventEligibleAgent(
        event.sourceAgent,
        `board event "${event.id}" sourceAgent`
      );
    }
    if (
      event.story.presentation !== "briefing" &&
      event.story.narrator !== "Kingdom Intel" &&
      !isEventEligibleAgent(event.story.narrator)
    ) {
      assertEventEligibleAgent(
        event.story.narrator,
        `board event "${event.id}" narrator`
      );
    }
  }
}

validateBoardEventAgents(boardEventRegistry);

export const boardEventById = new Map(
  boardEventRegistry.map((event) => [event.id, event])
);

export function getEventsByCategory(
  category: BoardEventDefinition["category"]
): BoardEventDefinition[] {
  return boardEventRegistry.filter((event) => event.category === category);
}

export function pickWeightedBoardEvent(
  pool: BoardEventDefinition[] = boardEventRegistry
): BoardEventDefinition {
  const weights = { common: 60, rare: 25, epic: 12, legendary: 3 };
  const total = pool.reduce((sum, e) => sum + weights[e.weight], 0);
  let roll = Math.random() * total;
  for (const event of pool) {
    roll -= weights[event.weight];
    if (roll <= 0) return event;
  }
  return pool[pool.length - 1];
}
