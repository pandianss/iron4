import { HeatmapCell, ChangeType } from "./heatmap"
import { SimulationPhase } from "../engine/simulation"
import { ScenarioClass } from "../../test/golden/types"
import { PolicyException, isExceptionValid, doesExceptionMatchHeatmap } from "./exceptions"
import { EscalationState, ScenarioSLA } from "./escalations"
import { BudgetForecast, ForecastAccuracyResult, ChaosBudget, ExecutiveCredibilityReport, RegulatoryAttestation } from "./chaos"
import { ScenarioId } from "./coupling"





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
    forecastRisk?: ReleaseRiskReport[]
    efci?: {
        index: number
        grade: string
    }
    isAttested?: boolean
}


export type ReleaseRiskReport = {
    scenarioId: ScenarioId
    riskScore: number // 0-100
    riskLevel: "low" | "medium" | "high" | "critical"
    factors: {
        decayRisk: number
        budgetRisk: number
        accuracyRisk: number
    }
}

export function calculateForecastDrivenReleaseRisk(
    scenarioId: ScenarioId,
    forecast: BudgetForecast,
    accuracy: ForecastAccuracyResult,
    budget: ChaosBudget,
    centrality: number
): ReleaseRiskReport {
    // 1. Decay Risk: related to forecasted gap
    const gap = forecast.forecast.expected // Points needed to close gap
    const decayRisk = Math.min(40, (gap / 10) * 40) // Clamped at 40

    // 2. Budget Risk: can we afford the pessimistic case?
    const pessimisticCost = forecast.forecast.pessimistic
    const budgetRisk = budget.remainingUnits < pessimisticCost ? 40 : 0

    // 3. Accuracy Risk: how much do we trust the forecast?
    const accuracyRisk = accuracy.withinBand ? 0 : 20

    const rawScore = (decayRisk + budgetRisk + accuracyRisk) * (1 + centrality)
    const riskScore = Math.min(100, rawScore)

    let riskLevel: ReleaseRiskReport["riskLevel"] = "low"
    if (riskScore >= 90) riskLevel = "critical"
    else if (riskScore >= 60) riskLevel = "high"
    else if (riskScore >= 30) riskLevel = "medium"

    return {
        scenarioId,
        riskScore,
        riskLevel,
        factors: { decayRisk, budgetRisk, accuracyRisk }
    }
}


export function evaluateReleaseGate(
    heatmap: readonly HeatmapCell[],
    policy: ReleaseGatePolicy,
    exceptions: readonly PolicyException[] = [],
    escalation?: EscalationState,
    openSLAs: readonly ScenarioSLA[] = [],
    forecastRisks: readonly ReleaseRiskReport[] = [],
    credibility?: ExecutiveCredibilityReport,
    latestAttestation?: RegulatoryAttestation,
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

    // Step 4: Enforce Forecast-Driven Risk
    for (const fr of forecastRisks) {
        if (fr.riskLevel === "critical") {
            rawDecision = "block-release"
            rationale.push(`Forecast block: Scenario ${fr.scenarioId} has CRITICAL forecast risk (score: ${fr.riskScore})`)
        } else if (fr.riskLevel === "high" && rawDecision !== "block-release") {
            rawDecision = "approve-with-review"
            rationale.push(`Forecast review: Scenario ${fr.scenarioId} has HIGH forecast risk (score: ${fr.riskScore})`)
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
        metrics: { totalSeverity, maxCellSeverity, affectedScenarios },
        forecastRisk: forecastRisks.length > 0 ? [...forecastRisks] : undefined,
        efci: credibility ? { index: credibility.index, grade: credibility.grade } : undefined,
        isAttested: !!latestAttestation
    }
}


