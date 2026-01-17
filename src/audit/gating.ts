import { HeatmapCell, ChangeType } from "./heatmap"
import { SimulationPhase } from "../engine/simulation"
import { ScenarioClass } from "../../test/golden/types"
import { PolicyException, isExceptionValid, doesExceptionMatchHeatmap } from "./exceptions"
import { EscalationState, ScenarioSLA } from "./escalations"



export type ReleaseDecision =
    | "auto-approve"
    | "approve-with-review"
    | "block-release"

export type ReleaseGatePolicy = {
    maxSeverityAllowed: number
    forbiddenChangeTypes: readonly ChangeType[]
    forbiddenPhases: readonly SimulationPhase[]
    escalationThresholds: {
        approveWithReview: number
        block: number
    }
    scenarioClassCaps: Record<ScenarioClass, number>
}

export const DefaultReleaseGatePolicy: ReleaseGatePolicy = {
    maxSeverityAllowed: 15,
    forbiddenChangeTypes: [
        "termination",
        "governance-decision",
        "policy-escalation"
    ],
    forbiddenPhases: [
        "TERMINATING"
    ],
    escalationThresholds: {
        approveWithReview: 5,
        block: 10
    },
    scenarioClassCaps: {
        "happy-path": 5,
        "warning-escalation": 8,
        "blocking-violation": 10,
        "max-ticks-termination": 5,
        "stability-termination": 5,
        "edge-case": 5,
        "failure-mode": 0
    }
}

export type ReleaseGateDecisionReport = {
    decision: ReleaseDecision
    rationale: string[]
    triggeringCells?: HeatmapCell[]
    metrics: {
        totalSeverity: number
        maxCellSeverity: number
        affectedScenarios: number
    }
}

export function evaluateReleaseGate(
    heatmap: readonly HeatmapCell[],
    policy: ReleaseGatePolicy,
    exceptions: readonly PolicyException[] = [],
    escalation?: EscalationState,
    openSLAs: readonly ScenarioSLA[] = [],
    now: Date = new Date()
): ReleaseGateDecisionReport {


    const rationale: string[] = []
    const triggeringCells: HeatmapCell[] = []

    const totalSeverity = heatmap.reduce((sum, c) => sum + c.severityScore, 0)
    const maxCellSeverity = Math.max(0, ...heatmap.map(c => c.severityScore))
    const affectedScenarios = new Set(heatmap.map(c => c.scenarioId)).size

    // Step 1: Check for hard blocks
    const forbiddenCells = heatmap.filter(c =>
        policy.forbiddenChangeTypes.includes(c.changeType) ||
        policy.forbiddenPhases.includes(c.phase) ||
        (policy.scenarioClassCaps[c.scenarioClass] !== undefined && c.severityScore > policy.scenarioClassCaps[c.scenarioClass])
    )

    let rawDecision: ReleaseDecision = "auto-approve"

    if (forbiddenCells.length > 0) {
        rawDecision = "block-release"
        forbiddenCells.forEach(c => {
            rationale.push(`Forbidden ${c.changeType} in ${c.scenarioId} (${c.phase})`)
            triggeringCells.push(c)
        })
    } else if (maxCellSeverity >= policy.escalationThresholds.block) {
        rawDecision = "block-release"
        rationale.push(`Max cell severity ${maxCellSeverity} exceeds block threshold ${policy.escalationThresholds.block}`)
    } else if (maxCellSeverity >= policy.escalationThresholds.approveWithReview) {
        rawDecision = "approve-with-review"
        rationale.push(`Max cell severity ${maxCellSeverity} exceeds review threshold ${policy.escalationThresholds.approveWithReview}`)
    }

    // Step 2: Apply Auto-Escalation Tightening
    if (escalation) {
        if (escalation.level === "freeze-release" || escalation.level === "pre-freeze") {
            rawDecision = "block-release"
            rationale.push(`Release ${escalation.level === "pre-freeze" ? "pre-frozen" : "frozen"} due to active escalations: ${escalation.activeRules.join(", ")}`)
        } else if (escalation.level === "require-governance-approval") {
            if (rawDecision !== "block-release") {
                rawDecision = "block-release"
                rationale.push("Escalated to governance approval: auto-approve disabled")
            }
        } else if (escalation.level === "require-review" || escalation.level === "pre-review") {
            if (rawDecision === "auto-approve") {
                rawDecision = "approve-with-review"
                rationale.push(`Escalated to ${escalation.level === "pre-review" ? "pre-emptive" : "mandatory"} review: auto-approve disabled`)
            }
        }
    }



    // Step 3: Enforce SLAs
    for (const sla of openSLAs) {
        if (sla.status === "breached") {
            rawDecision = "block-release"
            rationale.push(`Hard block: Scenario ${sla.scenarioId} SLA BREACHED`)
        } else if (sla.severity === "blocking") {
            rawDecision = "block-release"
            rationale.push(`Hard block: Scenario ${sla.scenarioId} has BLOCKING SLA`)
        } else if (sla.severity === "critical" && rawDecision !== "block-release") {
            rawDecision = "approve-with-review"
            rationale.push(`Mandatory review: Scenario ${sla.scenarioId} has CRITICAL SLA`)
        }
    }

    // Step 4: Consider Exceptions if blocked
    if (rawDecision === "block-release") {
        const validException = exceptions.find(ex =>
            isExceptionValid(ex, now) &&
            doesExceptionMatchHeatmap(ex, heatmap)
        )

        if (validException) {
            rationale.push(`Block overridden by valid exception: ${validException.id}`)
            return {
                decision: validException.allowedDecision,
                rationale,
                metrics: { totalSeverity, maxCellSeverity, affectedScenarios }
            }
        }
    }

    return {
        decision: rawDecision,
        rationale,
        triggeringCells: triggeringCells.length > 0 ? triggeringCells : undefined,
        metrics: { totalSeverity, maxCellSeverity, affectedScenarios }
    }
}
