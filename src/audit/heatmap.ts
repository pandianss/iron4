import { ScenarioClass } from "../../test/golden/types"
import { SimulationPhase } from "../engine/simulation"
import { AuditRecord } from "./audit-record"
import { AuditSemanticDiff } from "./diff"

export type ChangeType =
    | "none"
    | "migration-only"
    | "payload"
    | "action-sequence"
    | "governance-decision"
    | "policy-escalation"
    | "termination"

export type HeatmapCell = {
    scenarioId: string
    scenarioClass: ScenarioClass
    phase: SimulationPhase
    changeType: ChangeType
    severityScore: number
    occurrenceCount: number
    firstDivergenceTick: number
    examples: {
        ruleId?: string
        policyId?: string
        description: string
    }[]
}

const SeverityWeights: Record<ChangeType, number> = {
    none: 0,
    "migration-only": 1,
    payload: 2,
    "action-sequence": 4,
    "governance-decision": 8,
    "policy-escalation": 10,
    termination: 12
}

const ScenarioRiskMultiplier: Record<ScenarioClass, number> = {
    "happy-path": 1,
    "warning-escalation": 2,
    "blocking-violation": 3,
    "max-ticks-termination": 1,
    "stability-termination": 1,
    "edge-case": 3,
    "failure-mode": 4
}

export function phaseForAuditRecord(record: AuditRecord): SimulationPhase {
    switch (record.action) {
        case "initialize":
        case "migrate.state":
            return "INITIALIZED"
        case "transition.propose":
        case "governance.evaluate":
        case "policy.apply":
        case "transition.accept":
        case "transition.reject":
            return "RUNNING"
        case "terminate":
            return "TERMINATING"
        default:
            return "RUNNING"
    }
}

export type ChangeEvent = {
    scenarioId: string
    scenarioClass: ScenarioClass
    phase: SimulationPhase
    changeType: ChangeType
    divergenceTick: number
    ruleId?: string
    policyId?: string
    description: string
}

export function buildHeatmap(events: readonly ChangeEvent[]): HeatmapCell[] {
    const cells: Record<string, HeatmapCell> = {}

    for (const event of events) {
        const key = `${event.scenarioId}-${event.phase}-${event.changeType}`

        if (!cells[key]) {
            cells[key] = {
                scenarioId: event.scenarioId,
                scenarioClass: event.scenarioClass,
                phase: event.phase,
                changeType: event.changeType,
                severityScore: 0,
                occurrenceCount: 0,
                firstDivergenceTick: event.divergenceTick,
                examples: []
            }
        }

        const cell = cells[key]!
        cell.occurrenceCount += 1
        cell.firstDivergenceTick = Math.min(cell.firstDivergenceTick, event.divergenceTick)

        if (cell.examples.length < 3) {
            cell.examples.push({
                ruleId: event.ruleId,
                policyId: event.policyId,
                description: event.description
            })
        }

        // Update severity
        const baseWeight = SeverityWeights[event.changeType]
        const multiplier = ScenarioRiskMultiplier[event.scenarioClass] || 1
        cell.severityScore = baseWeight * cell.occurrenceCount * multiplier
    }

    return Object.values(cells)
}
