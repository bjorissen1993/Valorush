import type { KingdomProtocolDefinition } from "./types";

/**
 * Kingdom Director — rare world-level emergency protocols.
 * Each protocol maps to board event registry entries in `shared/events/`.
 */
export const kingdomProtocolRegistry: KingdomProtocolDefinition[] = [
  {
    id: "kingdom-alert",
    name: "Kingdom Alert",
    subtitle: "Mirror activity detected — all agents stand by",
    quote: "Priority alert. Possible mirror crossing on active sector. Confirm or disregard.",
    weight: "rare",
    protocolCode: "KNG-7741",
    eventIds: ["bind-teleporter", "lotus-rotating-doors"],
  },
  {
    id: "black-market-deployment",
    name: "Black Market Deployment",
    subtitle: "Unauthorized armorer channels opening sector-wide",
    quote: "Black market deployment authorized. Discounts and debts may apply to all operatives.",
    weight: "epic",
    protocolCode: "KNG-3310",
    eventIds: ["chamber-tax", "clove-gamble"],
  },
  {
    id: "combat-simulation",
    name: "Combat Simulation",
    subtitle: "Live-fire drill — creds on the line",
    quote: "Combat simulation active. Treat every engagement as ranked. No respawns on your wallet.",
    weight: "common",
    protocolCode: "KNG-1192",
    eventIds: ["brimstone-tdm", "kingdom-spike-rush"],
  },
  {
    id: "protocol-reset",
    name: "Protocol Reset",
    subtitle: "Emergency economy purge — mirror interference",
    quote: "Protocol reset initiated. Dimensional static may drain operative accounts. Hold position.",
    weight: "legendary",
    protocolCode: "KNG-0001",
    eventIds: ["fade-paranoia", "chamber-tax"],
  },
  {
    id: "spike-protocol",
    name: "Spike Protocol",
    subtitle: "Spike logistics override — cred stipend incoming",
    quote: "Spike protocol engaged. Logistics crate inbound for active operatives.",
    weight: "rare",
    protocolCode: "KNG-8844",
    eventIds: ["killjoy-cache", "kingdom-spike-rush"],
  },
  {
    id: "hazard-containment",
    name: "Hazard Containment",
    subtitle: "Radiant hazard zone — containment fees apply",
    quote: "Hazard containment in effect. Non-compliance will be billed to operative cred accounts.",
    weight: "epic",
    protocolCode: "KNG-5520",
    eventIds: ["breach-shockwave", "deadlock-lockdown"],
  },
  {
    id: "experimental-weapons-test",
    name: "Experimental Weapons Test",
    subtitle: "Kingdom R&D — weapon discount lottery",
    quote: "Experimental weapons test live. Next-buy discounts available to compliant operatives.",
    weight: "rare",
    protocolCode: "KNG-6677",
    eventIds: ["chamber-tax", "viper-escalation"],
  },
  {
    id: "radiant-storm",
    name: "Radiant Storm",
    subtitle: "Radiant energy surge — radianite redistribution",
    quote: "Radiant storm detected. Radianite fragments may manifest near active operatives.",
    weight: "legendary",
    protocolCode: "KNG-9900",
    eventIds: ["skye-trail-boost", "astra-cosmic-divide", "killjoy-cache"],
  },
];

export const kingdomProtocolById = new Map(
  kingdomProtocolRegistry.map((entry) => [entry.id, entry])
);
