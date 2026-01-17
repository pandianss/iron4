import { ScenarioId, CouplingGraph, getCoupledScenarios } from "./coupling"

export type RolloutAction = "deploy-forward" | "rollback" | "hybrid"

export type StabilizationRule = {
    maxRiskIncrease: number
    requireBandClearance: boolean
    observationWindowDays: number
}

export type RolloutPhase = {
    phaseId: string
    scenarios: readonly ScenarioId[]
    action: RolloutAction
    stabilizationCheck: StabilizationRule
}

export type RolloutSequencingInput = {
    changeSetId: string
    affectedScenarios: readonly ScenarioId[]
    couplingGraph: CouplingGraph
    strategy: "forward-only" | "rollback-only" | "hybrid"
    riskTolerance: {
        maxInterimRisk: number
        requireWorstCaseClear: boolean
    }
    stabilizationWindowDays: number
}

/**
 * CARS: Automated Coupling-Aware Rollout Sequencing
 * Derives a safe rollout order using topological sort on the coupling graph.
 */
export function generateRolloutPlan(input: RolloutSequencingInput): RolloutPhase[] {
    const { affectedScenarios, couplingGraph, strategy, stabilizationWindowDays } = input

    // 1. Filter graph to affected scenarios
    const subgraphNodes = affectedScenarios.filter(id => couplingGraph.nodes[id])
    const subgraphEdges = couplingGraph.edges.filter(e =>
        affectedScenarios.includes(e.from) && affectedScenarios.includes(e.to)
    )

    // 2. Determine Order (Topological Sort)
    // Simple implementation for demonstration: 
    // In a real system, we'd use a full Kahns algorithm and handle cycles.
    // Here we'll group by "dependency depth"

    const deps: Record<ScenarioId, Set<ScenarioId>> = {}
    subgraphNodes.forEach(id => deps[id] = new Set())
    subgraphEdges.forEach(e => {
        // we use writer -> reader or highest-risk -> lowest logic (simplified here as from -> to)
        deps[e.to].add(e.from)
    })

    const order: ScenarioId[] = []
    const visited = new Set<ScenarioId>()
    const visiting = new Set<ScenarioId>()

    function visit(id: ScenarioId) {
        if (visited.has(id)) return
        if (visiting.has(id)) {
            // Cycle detected - in CARS design this forces atomic rollout (same phase)
            return
        }
        visiting.add(id)
        deps[id].forEach(depId => visit(depId))
        visiting.delete(id)
        visited.add(id)
        order.push(id)
    }

    subgraphNodes.forEach(id => visit(id))

    // 3. Generate Phases
    // For simplicity, each scenario gets its own phase in the sorted order
    // unless there was a cycle (which we'd handle by grouping)

    return order.map((id, index) => ({
        phaseId: `phase-${index + 1}`,
        scenarios: [id],
        action: strategy === "hybrid" ? "hybrid" : (strategy === "rollback-only" ? "rollback" : "deploy-forward"),
        stabilizationCheck: {
            maxRiskIncrease: index === 0 ? 0 : 1, // Stricter for first phase
            requireBandClearance: true,
            observationWindowDays: stabilizationWindowDays
        }
    }))
}
