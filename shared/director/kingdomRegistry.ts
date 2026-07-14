import type { KingdomProtocolDefinition } from "./types";

/**
 * Kingdom Director — rare world-level emergency protocols.
 * Each protocol maps to existing event pool mechanics (or stubs via shared events).
 */
export const kingdomProtocolRegistry: KingdomProtocolDefinition[] = [
  {
    id: "kingdom-alert",
    name: "Kingdom Alert",
    subtitle: "Mirror activity detected — all agents stand by",
    quote: "Priority alert. Possible mirror crossing on active sector. Confirm or disregard.",
    weight: "rare",
    protocolCode: "KNG-7741",
    eventIds: ["mirror-briefing"],
  },
  {
    id: "black-market-deployment",
    name: "Black Market Deployment",
    subtitle: "Unauthorized armorer channels opening sector-wide",
    quote: "Black market deployment authorized. Discounts and debts may apply to all operatives.",
    weight: "epic",
    protocolCode: "KNG-3310",
    eventIds: ["cypher-market-gamble", "chamber-invoice-gamble"],
  },
  {
    id: "combat-simulation",
    name: "Combat Simulation",
    subtitle: "Live-fire drill — creds on the line",
    quote: "Combat simulation active. Treat every engagement as ranked. No respawns on your wallet.",
    weight: "common",
    protocolCode: "KNG-1192",
    eventIds: ["brimstone-smoke-gamble"],
  },
  {
    id: "protocol-reset",
    name: "Protocol Reset",
    subtitle: "Emergency economy purge — mirror interference",
    quote: "Protocol reset initiated. Dimensional static may drain operative accounts. Hold position.",
    weight: "legendary",
    protocolCode: "KNG-0001",
    eventIds: ["mirror-glitch"],
  },
  {
    id: "spike-protocol",
    name: "Spike Protocol",
    subtitle: "Spike logistics override — cred stipend incoming",
    quote: "Spike protocol engaged. Logistics crate inbound for active operatives.",
    weight: "rare",
    protocolCode: "KNG-8844",
    eventIds: ["supply-ascent", "killjoy-cache"],
  },
  {
    id: "hazard-containment",
    name: "Hazard Containment",
    subtitle: "Radiant hazard zone — containment fees apply",
    quote: "Hazard containment in effect. Non-compliance will be billed to operative cred accounts.",
    weight: "epic",
    protocolCode: "KNG-5520",
    eventIds: ["breach-standoff", "mirror-glitch"],
  },
  {
    id: "experimental-weapons-test",
    name: "Experimental Weapons Test",
    subtitle: "Kingdom R&D — weapon discount lottery",
    quote: "Experimental weapons test live. Next-buy discounts available to compliant operatives.",
    weight: "rare",
    protocolCode: "KNG-6677",
    eventIds: ["chamber-invoice-gamble", "omen-smoke-deal"],
  },
  {
    id: "radiant-storm",
    name: "Radiant Storm",
    subtitle: "Radiant energy surge — radianite redistribution",
    quote: "Radiant storm detected. Radianite fragments may manifest near active operatives.",
    weight: "legendary",
    protocolCode: "KNG-9900",
    eventIds: ["sova-intel", "kayo-memory", "skye-trail"],
  },
];

export const kingdomProtocolById = new Map(
  kingdomProtocolRegistry.map((entry) => [entry.id, entry])
);
