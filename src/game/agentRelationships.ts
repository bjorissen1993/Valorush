export type RelationshipKind = "ally" | "rival" | "mentor" | "neutral";

export type AgentRelation = {
  agent: string;
  kind: RelationshipKind;
};

/**
 * Lore relationships (Valorant wiki / voice lines).
 * Stored one-way; lookup checks both directions.
 */
const RELATION_MAP: Record<string, AgentRelation[]> = {
  Brimstone: [
    { agent: "Viper", kind: "ally" },
    { agent: "Killjoy", kind: "mentor" },
    { agent: "Sage", kind: "ally" },
    { agent: "KAY/O", kind: "ally" },
    { agent: "Breach", kind: "rival" },
  ],
  Viper: [
    { agent: "Omen", kind: "ally" },
    { agent: "Brimstone", kind: "ally" },
  ],
  Killjoy: [
    { agent: "Raze", kind: "ally" },
    { agent: "Brimstone", kind: "ally" },
    { agent: "Neon", kind: "ally" },
  ],
  Raze: [{ agent: "Killjoy", kind: "ally" }],
  Jett: [
    { agent: "Neon", kind: "rival" },
    { agent: "Sage", kind: "ally" },
  ],
  Neon: [
    { agent: "Jett", kind: "rival" },
    { agent: "Sage", kind: "ally" },
    { agent: "Killjoy", kind: "ally" },
    { agent: "Chamber", kind: "rival" },
    { agent: "Reyna", kind: "rival" },
    { agent: "Astra", kind: "ally" },
  ],
  Sage: [
    { agent: "Neon", kind: "mentor" },
    { agent: "Jett", kind: "ally" },
    { agent: "Brimstone", kind: "ally" },
  ],
  Sova: [{ agent: "Cypher", kind: "rival" }],
  Cypher: [{ agent: "Sova", kind: "rival" }],
  Omen: [{ agent: "Viper", kind: "ally" }],
  Phoenix: [
    { agent: "Sage", kind: "ally" },
    { agent: "Brimstone", kind: "mentor" },
    { agent: "Yoru", kind: "rival" },
  ],
  Yoru: [{ agent: "Phoenix", kind: "rival" }],
  Skye: [{ agent: "Fade", kind: "ally" }],
  Fade: [{ agent: "Skye", kind: "ally" }],
  Reyna: [{ agent: "Neon", kind: "rival" }],
  Chamber: [{ agent: "Neon", kind: "rival" }],
  "KAY/O": [{ agent: "Brimstone", kind: "ally" }],
  Breach: [{ agent: "Brimstone", kind: "rival" }],
  Astra: [{ agent: "Neon", kind: "ally" }],
};

export function getRelationship(
  agentA: string,
  agentB: string
): RelationshipKind {
  if (agentA === agentB) return "neutral";

  const fromA = RELATION_MAP[agentA]?.find((r) => r.agent === agentB)?.kind;
  if (fromA) return fromA;

  const fromB = RELATION_MAP[agentB]?.find((r) => r.agent === agentA)?.kind;
  if (fromB) return fromB;

  return "neutral";
}

export function getRelatedAgents(
  agentName: string,
  kind?: RelationshipKind
): string[] {
  const direct = RELATION_MAP[agentName] ?? [];
  const inverse = Object.entries(RELATION_MAP).flatMap(([name, relations]) =>
    relations
      .filter((r) => r.agent === agentName)
      .map((r) => ({ agent: name, kind: r.kind }))
  );

  const merged = new Map<string, RelationshipKind>();
  for (const r of direct) merged.set(r.agent, r.kind);
  for (const r of inverse) merged.set(r.agent, r.kind);

  return [...merged.entries()]
    .filter(([, relKind]) => !kind || relKind === kind)
    .map(([name]) => name);
}

export function getAllies(agentName: string): string[] {
  return getRelatedAgents(agentName, "ally");
}

export function getMentors(agentName: string): string[] {
  return getRelatedAgents(agentName, "mentor");
}

export function getRivals(agentName: string): string[] {
  return getRelatedAgents(agentName, "rival");
}

/** Allies + mentors — people who would realistically help this agent. */
export function getSupporters(agentName: string): string[] {
  return [...new Set([...getAllies(agentName), ...getMentors(agentName)])];
}
