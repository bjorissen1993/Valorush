import type { GameEvent } from "../types/Game";
import {
  abilityIconPath,
  mapLoadingPath,
  pointsIconPath,
  roleSymbolPath,
} from "./assetPaths";

/**
 * Lore-driven board events.
 * - Map loading backgrounds (not agent backgrounds) to distinguish from shops.
 * - Agent presentation only for narrators with NPC models.
 * - Briefing presentation for comms-only events (no body model).
 * - Gamble events roll win/lose at trigger time.
 */
export const eventPool: GameEvent[] = [
  {
    id: "brimstone-smoke-gamble",
    title: "Smoke Call",
    description: "Brimstone's line either saves the site or costs you creds.",
    effect: {
      type: "gamble",
      winChance: 0.5,
      win: {
        effect: { type: "creds", amount: 200 },
        mood: "positive",
        headline: "Smoke lands on the money",
        speech:
          "Site's clear. Take the stipend and rotate before they punish that gap.",
        description: "Perfect smoke — Brimstone clears mid (+200 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -200 },
        mood: "negative",
        headline: "Wrong smoke, wrong round",
        speech:
          "You're buying map control with my mistake. Don't get lost in the smoke again.",
        description: "Bad smoke — you lose creds in the choke (-200 Creds).",
      },
    },
    story: {
      headline: "Brimstone calls the smoke line",
      tag: "Protocol",
      mood: "neutral",
      narrator: "Brimstone",
      narratorRole: "Protocol Commander",
      backgroundImage: mapLoadingPath("Ascent"),
      accentImage: roleSymbolPath("controller"),
      paragraphs: [
        "Brimstone marks Ascent mid with the same calm he uses when mirror agents push too hard.",
        "\"Kid, this smoke either wins the round or eats your buy. Ready?\"",
      ],
    },
  },
  {
    id: "killjoy-cache",
    title: "Nanobomb's Cache",
    description: "Killjoy's spare parts fund your next buy (+200 Creds).",
    effect: { type: "creds", amount: 200 },
    story: {
      headline: "A gadget crate with your name on it",
      tag: "Founders",
      mood: "positive",
      relatedAgents: ["Killjoy", "Raze", "Brimstone"],
      narrator: "Killjoy",
      narratorRole: "Protocol Engineer",
      backgroundImage: mapLoadingPath("Split"),
      accentImage: abilityIconPath("killjoy", "Lockdown"),
      paragraphs: [
        "Killjoy slides a crate across the Split lab floor.",
        "\"Brimstone says we're flush. Raze wanted to blow the fuses for fun. I said no.\"",
      ],
    },
  },
  {
    id: "jett-neon-gamble",
    title: "Speed Check",
    description: "Back the duelists' side bet — win creds or lose your stake.",
    effect: {
      type: "gamble",
      winChance: 0.45,
      win: {
        effect: { type: "creds", amount: 150 },
        mood: "positive",
        headline: "Your pick crosses first",
        speech: "Told you I'm faster. Split the pot and stop doubting wind.",
        description: "Side bet pays out (+150 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -150 },
        mood: "negative",
        headline: "Neon sparks past your call",
        speech: "Wrong horse. Pay up — sparks don't lie.",
        description: "Bad call on the race (-150 Creds).",
      },
    },
    story: {
      headline: "Jett and Neon want a judge",
      relatedAgents: ["Jett", "Neon"],
      tag: "Rivalry",
      mood: "neutral",
      narrator: "Jett",
      narratorRole: "Duelist",
      backgroundImage: mapLoadingPath("Sunset"),
      accentImage: roleSymbolPath("duelist"),
      paragraphs: [
        "Two blurs cut across Sunset yard. Jett grins; Neon sparks at the line.",
        "\"Pick a winner. Kingdom creds on the line.\"",
      ],
    },
  },
  {
    id: "sova-intel",
    title: "Owl Drone Intel",
    description: "Sova marks a radianite stash (+1 Radianite).",
    effect: { type: "radianite", amount: 1 },
    story: {
      headline: "Recon Bolt pings something worth taking",
      tag: "Intel",
      mood: "positive",
      relatedAgents: ["Sova", "Cypher"],
      narrator: "Sova",
      narratorRole: "Initiator",
      backgroundImage: mapLoadingPath("Haven"),
      accentImage: abilityIconPath("sova", "Recon_Bolt"),
      paragraphs: [
        "Sova's drone returns with grainy Haven site feed — radianite residue, recent.",
        "\"Take it before the other side rotates. Quiet.\"",
      ],
    },
  },
  {
    id: "cypher-market-gamble",
    title: "Spycam Payout",
    description: "Cypher's back-channel either discounts your buy or taxes it.",
    effect: {
      type: "gamble",
      winChance: 0.55,
      win: {
        effect: { type: "discount", amount: 200 },
        mood: "positive",
        headline: "Back-channel unlocked",
        speech:
          "Armorer undercuts Kingdom this week. Consider it professional courtesy.",
        description: "Black market hookup (-200 on next weapon).",
      },
      lose: {
        effect: { type: "creds", amount: -150 },
        mood: "negative",
        headline: "Channel compromised",
        speech: "Someone traced the feed. Pay the cleanup fee and forget you asked.",
        description: "Spycam leak costs you (-150 Creds).",
      },
    },
    story: {
      headline: "Information has a price",
      tag: "Black Market",
      mood: "neutral",
      narrator: "Cypher",
      narratorRole: "Sentinel",
      backgroundImage: mapLoadingPath("Pearl"),
      accentImage: abilityIconPath("cypher", "Spycam"),
      paragraphs: [
        "An encrypted Pearl feed opens — wireframe site, no face.",
        "\"Chamber isn't the only one who sells favors.\"",
      ],
    },
  },
  {
    id: "viper-omen-shadow",
    title: "Shadow Cabinet",
    description: "Secrets in the dark (+1 Radianite).",
    effect: { type: "radianite", amount: 1 },
    story: {
      headline: "Viper and Omen share what no one else hears",
      tag: "Mysterious",
      mood: "mysterious",
      narrator: "Viper",
      narratorRole: "Protocol Founder",
      backgroundImage: mapLoadingPath("Bind"),
      accentImage: roleSymbolPath("controller"),
      paragraphs: [
        "Smoke rolls through an empty Bind corridor. Viper's mask gleams in the dark.",
        "\"Don't ask where this came from. Take it and leave.\"",
      ],
    },
  },
  {
    id: "chamber-invoice-gamble",
    title: "Premium Invoice",
    description: "Chamber's favor either cuts a deal or sends a bill.",
    effect: {
      type: "gamble",
      winChance: 0.4,
      win: {
        effect: { type: "discount", amount: 250 },
        mood: "positive",
        headline: "Concierge owes you one",
        speech: "Fine. A courtesy discount — don't tell Neon I was soft.",
        description: "Chamber waives part of the fee (-250 on next weapon).",
      },
      lose: {
        effect: { type: "creds", amount: -200 },
        mood: "negative",
        headline: "Premium logistics, premium price",
        speech: "Services rendered. Balance due. Next time read the contract.",
        description: "Chamber's invoice clears (-200 Creds).",
      },
    },
    story: {
      headline: "The concierge sends paperwork",
      tag: "Debt",
      mood: "neutral",
      narrator: "Chamber",
      narratorRole: "Weapons Dealer",
      backgroundImage: mapLoadingPath("Lotus"),
      accentImage: abilityIconPath("chamber", "Headhunter"),
      paragraphs: [
        "A gold-trimmed Lotus manifest pings your tac screen.",
        "\"Premium logistics has terms. Sign or pay.\"",
      ],
    },
  },
  {
    id: "sage-resilience",
    title: "Monarch's Mercy",
    description: "Sage patches up your economy (+200 Creds).",
    effect: { type: "creds", amount: 200 },
    story: {
      headline: "Healing extends to more than HP",
      tag: "Radiant",
      mood: "positive",
      narrator: "Sage",
      narratorRole: "Monarch",
      backgroundImage: mapLoadingPath("Icebox"),
      accentImage: abilityIconPath("sage", "Healing_Orb"),
      paragraphs: [
        "Sage finds you staring at a cracked cred reader after a brutal eco.",
        "\"We're a team. That includes the wallet.\"",
      ],
    },
  },
  {
    id: "kayo-memory",
    title: "Memory Core",
    description: "KAY/O surfaces a war fragment (+1 Radianite).",
    effect: { type: "radianite", amount: 1 },
    story: {
      headline: "A machine remembers what humans try to forget",
      tag: "Radiant War",
      mood: "neutral",
      narrator: "KAY/O",
      narratorRole: "Combat Machine",
      backgroundImage: mapLoadingPath("Fracture"),
      accentImage: abilityIconPath("kayo", "ZERO-point"),
      paragraphs: [
        "KAY/O stops mid-patrol. Static floods his visor — a battlefield out of time.",
        "\"Take the shard. Fight better than last time.\"",
      ],
    },
  },
  {
    id: "raze-demo-gamble",
    title: "Demo Fee",
    description: "Raze's \"controlled\" blast either pays out or trashes your gear.",
    effect: {
      type: "gamble",
      winChance: 0.45,
      win: {
        effect: { type: "creds", amount: 150 },
        mood: "positive",
        headline: "Controlled chaos pays",
        speech: "See? Perfect demo. Kingdom owes us hazard pay.",
        description: "Demo bounty approved (+150 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -200 },
        mood: "negative",
        headline: "Boom Bot does not read fine print",
        speech: "Okay maybe that one got away from me. You're covering damages.",
        description: "Structural bill lands (-200 Creds).",
      },
    },
    story: {
      headline: "Raze wants to test something loud",
      tag: "Chaos",
      mood: "neutral",
      narrator: "Raze",
      narratorRole: "Duelist",
      backgroundImage: mapLoadingPath("Breeze"),
      accentImage: abilityIconPath("raze", "Boom_Bot"),
      paragraphs: [
        "Raze grins at a Breeze site wall with fresh scorch marks.",
        "\"Trust me. Totally controlled. Mostly.\"",
      ],
    },
  },
  {
    id: "fade-whispers-gamble",
    title: "Nightmare Tip",
    description: "Fade's hunch either saves your buy or costs you for ignoring it.",
    effect: {
      type: "gamble",
      winChance: 0.5,
      win: {
        effect: { type: "creds", amount: 150 },
        mood: "positive",
        headline: "Nightmare was right",
        speech: "Told you — fake B. Hold creds and laugh when the rush never comes.",
        description: "Intel saves your buy (+150 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -150 },
        mood: "negative",
        headline: "You ignored the dark",
        speech: "Mirror team hit A while you bought wrong. I warned you.",
        description: "Bad read after the tip (-150 Creds).",
      },
    },
    story: {
      headline: "Something in the dark has advice",
      tag: "Intel",
      mood: "neutral",
      narrator: "Fade",
      narratorRole: "Initiator",
      backgroundImage: mapLoadingPath("Pearl"),
      accentImage: abilityIconPath("fade", "Haunt"),
      paragraphs: [
        "Fade's eyes go white on Pearl catwalk.",
        "\"Don't purchase yet. Or do — your creds, your funeral.\"",
      ],
    },
  },
  {
    id: "mirror-glitch",
    title: "Mirrorverse Static",
    description: "Dimensional interference drains creds (-200).",
    effect: { type: "creds", amount: -200 },
    story: {
      headline: "Reality hiccups — your wallet feels it first",
      tag: "Mirrorverse",
      mood: "negative",
      narrator: "Astra",
      narratorRole: "Astral Guardian",
      backgroundImage: mapLoadingPath("Abyss"),
      accentImage: pointsIconPath("radianite"),
      paragraphs: [
        "Astra's stars flicker over Abyss — a map that shouldn't sync with your cred chip.",
        "\"Mirror agents crossed. Briefly. Pay the static tax.\"",
      ],
    },
  },
  {
    id: "skye-trail",
    title: "Guiding Light",
    description: "Skye's seekers find radianite (+1 Radianite).",
    effect: { type: "radianite", amount: 1 },
    story: {
      headline: "Trailblazer picks up a scent worth following",
      tag: "Recovery",
      mood: "positive",
      narrator: "Skye",
      narratorRole: "Initiator",
      backgroundImage: mapLoadingPath("Lotus"),
      accentImage: abilityIconPath("skye", "Guiding_Light"),
      paragraphs: [
        "Skye's creature loops Lotus site twice, then chirps — loot nearby.",
        "\"Split what we find. Move before mirror rotates.\"",
      ],
    },
  },
  {
    id: "breach-standoff",
    title: "Fault Line",
    description: "Breach clashes with command (-200 Creds).",
    effect: { type: "creds", amount: -200 },
    story: {
      headline: "Two hard heads, one fine",
      tag: "Conflict",
      mood: "negative",
      narrator: "Breach",
      narratorRole: "Initiator",
      backgroundImage: mapLoadingPath("Fracture"),
      accentImage: abilityIconPath("breach", "Fault_Line"),
      paragraphs: [
        "Breach slams the Fracture war table hard enough to crack a mug.",
        "\"You're billed for the mug and the productivity loss. Sorry.\"",
      ],
    },
  },
  {
    id: "reyna-empress-tax",
    title: "Empress Tax",
    description: "Reyna demands tribute — pay up or slip past her patrol.",
    effect: {
      type: "gamble",
      winChance: 0.4,
      win: {
        effect: { type: "creds", amount: 150 },
        mood: "positive",
        headline: "You slipped past the Empress",
        speech:
          "Smart. I almost respected that flank. Take the creds and don't make me hunt you.",
        description: "Clean route — tribute avoided (+150 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -200 },
        mood: "negative",
        headline: "Empress collects her due",
        speech:
          "You walked into my lane like you owned it. Pay the tax or bleed for free next time.",
        description: "Reyna's tribute lands (-200 Creds).",
      },
    },
    story: {
      headline: "Reyna blocks the lane",
      tag: "Duelist",
      mood: "neutral",
      narrator: "Reyna",
      narratorRole: "Radiant Empress",
      backgroundImage: mapLoadingPath("Sunset"),
      accentImage: abilityIconPath("reyna", "Empress"),
      paragraphs: [
        "Reyna steps out of Sunset B main smoke, violet eyes locked on your cred reader.",
        "\"This corridor has a fee. Pay me, or try your luck.\"",
      ],
    },
  },
  {
    id: "yoru-fakeout-gamble",
    title: "Dimensional Bluff",
    description: "Call Yoru's fakeout — right read pays, wrong read costs.",
    effect: {
      type: "gamble",
      winChance: 0.5,
      win: {
        effect: { type: "creds", amount: 175 },
        mood: "positive",
        headline: "You read the rift",
        speech:
          "Ha. You actually saw the real me. Split the pot before I change my mind.",
        description: "Fakeout called correctly (+175 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -175 },
        mood: "negative",
        headline: "You chased the decoy",
        speech:
          "Wrong dimension, wrong call. Pay up — the rift doesn't refund mistakes.",
        description: "Fell for the fake (-175 Creds).",
      },
    },
    story: {
      headline: "Yoru wants a judge on Bind",
      tag: "Mirrorverse",
      mood: "mysterious",
      narrator: "Yoru",
      narratorRole: "Dimensional Duelist",
      backgroundImage: mapLoadingPath("Bind"),
      accentImage: abilityIconPath("yoru", "Fakeout"),
      paragraphs: [
        "Two Yorus flicker across Bind A short — one solid, one static.",
        "\"Bet creds you know which one is real. Or don't. I enjoy watching you guess.\"",
      ],
    },
  },
  {
    id: "omen-smoke-deal",
    title: "Smoke Deal",
    description: "Omen's back-channel either cuts your next buy or sends a bill.",
    effect: {
      type: "gamble",
      winChance: 0.45,
      win: {
        effect: { type: "discount", amount: 200 },
        mood: "positive",
        headline: "Shadow discount unlocked",
        speech:
          "Consider it a favor from the dark. Buy quiet — and don't mention Viper.",
        description: "Omen's hookup (-200 on next weapon).",
      },
      lose: {
        effect: { type: "creds", amount: -175 },
        mood: "negative",
        headline: "Smoke tax collected",
        speech:
          "Information from the shadows isn't free. Pay the fee and forget you asked.",
        description: "Back-channel costs you (-175 Creds).",
      },
    },
    story: {
      headline: "A voice from the smoke offers terms",
      tag: "Controller",
      mood: "mysterious",
      narrator: "Omen",
      narratorRole: "Shadow Agent",
      backgroundImage: mapLoadingPath("Haven"),
      accentImage: abilityIconPath("omen", "Dark_Cover"),
      paragraphs: [
        "Omen materializes at the edge of Haven C long smoke, hood low, orb dim.",
        "\"I can soften your next buy. Or I can bill you for wasting my time.\"",
      ],
    },
  },
  {
    id: "mirror-briefing",
    title: "Mirror Ping",
    description: "HQ tracks mirror movement — bonus stipend or false alarm fee.",
    effect: {
      type: "gamble",
      winChance: 0.5,
      win: {
        effect: { type: "creds", amount: 175 },
        mood: "positive",
        headline: "Ping confirmed — stipend released",
        speech:
          "Mirror push cancelled. Take the logistics bonus and hold your buy.",
        description: "Accurate intel bonus (+175 Creds).",
      },
      lose: {
        effect: { type: "creds", amount: -175 },
        mood: "negative",
        headline: "False alarm — rotation cost",
        speech:
          "HQ called a fake. You rotated wrong and burned creds on a ghost push.",
        description: "Bad comms cost you (-175 Creds).",
      },
    },
    story: {
      headline: "Mirror agents flagged on comms",
      tag: "Intel Brief",
      mood: "neutral",
      presentation: "briefing",
      narrator: "Kingdom Intel",
      narratorRole: "Online Briefing",
      backgroundImage: mapLoadingPath("Bind"),
      accentImage: pointsIconPath("kingdom"),
      paragraphs: [
        "Bind satellite overlay pulses red on your tac HUD.",
        "\"Possible mirror crossing. Confirm or disregard at your own risk.\"",
      ],
    },
  },
  {
    id: "supply-ascent",
    title: "Ascent Supply Drop",
    description: "Protocol logistics deliver (+200 Creds).",
    effect: { type: "creds", amount: 200 },
    story: {
      headline: "Standard issue — dropped mid-round",
      tag: "Logistics",
      mood: "positive",
      narrator: "Killjoy",
      narratorRole: "Protocol Engineer",
      backgroundImage: mapLoadingPath("Ascent"),
      accentImage: pointsIconPath("kingdom"),
      paragraphs: [
        "A Kingdom crate lands on Ascent A main — Killjoy's seal on the lock.",
        "\"Don't spend it all on Op. Probably Viper's handwriting.\"",
      ],
    },
  },
];

export function getRandomEvent(pool: GameEvent[] = eventPool): GameEvent {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatEventEffect(event: GameEvent): string {
  const effect =
    event.outcome?.effect ??
    (event.effect.type !== "gamble" ? event.effect : null);

  if (!effect) return "Win or lose";

  switch (effect.type) {
    case "creds":
      return effect.amount >= 0
        ? `+${effect.amount} Creds`
        : `${effect.amount} Creds`;
    case "radianite":
      return effect.amount >= 0
        ? `+${effect.amount} Radianite`
        : `${effect.amount} Radianite`;
    case "discount":
      return `-${effect.amount} on next weapon`;
    default:
      return event.description;
  }
}

export function formatEventOutcomeLabel(event: GameEvent): string {
  if (event.outcome?.gambleResult === "win") return "You won";
  if (event.outcome?.gambleResult === "lose") return "You lost";
  if (event.effect.type === "gamble" && !event.outcome) return "At stake";
  return event.outcome?.effect && event.outcome.effect.type === "creds" &&
    event.outcome.effect.amount < 0
    ? "Cost"
    : "Reward";
}
