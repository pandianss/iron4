import { ChangeType, HeatmapCell } from "./heatmap"
import { SimulationPhase } from "../engine/simulation"

export type ExceptionScope = {
    commitRange?: { from: string; to: string }
    scenarios?: readonly string[]
    changeTypes?: readonly ChangeType[]
    phases?: readonly SimulationPhase[]
}

export type ExceptionTimeBox = {
    issuedAt: string
    expiresAt: string
}

export type PolicyException = {
    id: string
    title: string
    description: string
    scope: ExceptionScope
    allowedDecision: "approve-with-review" | "auto-approve"
    justification: {
        reason: string
        riskAssessment: string
        mitigationPlan: string
    }
    timeBox: ExceptionTimeBox
    createdBy: string
    createdAt: string
}

export function isExceptionValid(exception: PolicyException, now: Date): boolean {
    return now <= new Date(exception.timeBox.expiresAt)
}

export function doesExceptionMatchHeatmap(exception: PolicyException, heatmap: readonly HeatmapCell[]): boolean {
    const { scope } = exception

    for (const cell of heatmap) {
        if (cell.changeType === "none") continue

        // Check scenarios
        if (scope.scenarios && !scope.scenarios.includes(cell.scenarioId)) return false

        // Check change types
        if (scope.changeTypes && !scope.changeTypes.includes(cell.changeType)) return false

        // Check phases
        if (scope.phases && !scope.phases.includes(cell.phase)) return false
    }

    return true
}
