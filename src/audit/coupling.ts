import { ScenarioClass } from "../../test/golden/types"

export type ScenarioId = string

export type CouplingSignal =
    | "shared-rule"
    | "shared-policy"
    | "shared-state"
    | "temporal-cascade"
    | "mitigation-interaction"

export type CouplingEvidence = {
    source: "audit-diff" | "heatmap" | "band-correlation" | "mitigation-simulation"
    description: string
    strength: number // 0–1
}

export type CouplingEdge = {
    from: ScenarioId
    to: ScenarioId
    type: CouplingSignal
    weight: number // 0–1 normalized
    evidence: readonly CouplingEvidence[]
    discoveredAt: string
}

export type ScenarioNode = {
    scenarioId: string
    scenarioClass: ScenarioClass
}

export type CouplingGraph = {
    nodes: Record<ScenarioId, ScenarioNode>
    edges: readonly CouplingEdge[]
}

export type CouplingStrength = "weak" | "moderate" | "strong"

export function getCouplingStrength(weight: number): CouplingStrength {
    if (weight >= 0.6) return "strong"
    if (weight >= 0.3) return "moderate"
    return "weak"
}

/**
 * Composites multiple evidence strengths using the law of diminishing returns:
 * weight = 1 - Π (1 - evidence.strength)
 */
export function compositeWeight(evidences: readonly CouplingEvidence[]): number {
    if (evidences.length === 0) return 0
    const product = evidences.reduce((acc, ev) => acc * (1 - ev.strength), 1)
    return 1 - product
}

export function getCoupledScenarios(
    graph: CouplingGraph,
    scenarioId: ScenarioId,
    minWeight: number = 0.3
): ScenarioId[] {
    const coupled = new Set<ScenarioId>()

    // Check outgoing and incoming for undirected-like coupling
    for (const edge of graph.edges) {
        if (edge.from === scenarioId && edge.weight >= minWeight) {
            coupled.add(edge.to)
        }
        if (edge.to === scenarioId && edge.weight >= minWeight) {
            coupled.add(edge.from)
        }
    }

    return Array.from(coupled)
}
