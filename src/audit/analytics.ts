import { PolicyException } from "./exceptions"
import { HeatmapCell, ChangeType } from "./heatmap"
import { ReleaseGateDecisionReport } from "./gating"
import { AuditRecord } from "./audit-record"
import { ScenarioClass } from "../../test/golden/types"
import { SimulationPhase } from "../engine/simulation"

export type GlobalExceptionMetrics = {
    activeExceptions: number
    expiredExceptions: number
    averageDurationDays: number
    maxDurationDays: number
    exceptionVelocity: number
}

export type RiskWeightedLoad = {
    totalRiskScore: number
    byScenarioClass: Record<ScenarioClass, number>
    byChangeType: Record<ChangeType, number>
}

export type ExceptionHotspot = {
    dimension: "scenario" | "rule" | "policy" | "phase"
    id: string
    exceptionCount: number
    cumulativeRisk: number
    repeated: boolean
}

export type ExceptionAging = {
    under3Days: number
    days3to7: number
    days7to14: number
    expired: number
}

export type AccountabilityMetrics = {
    byRequester: Record<string, number>
    byApprover: Record<string, number>
    repeatedPairs: {
        requester: string
        approver: string
        count: number
    }[]
}

export type ExceptionAnalyticsOutput = {
    global: GlobalExceptionMetrics
    riskLoad: RiskWeightedLoad
    hotspots: ExceptionHotspot[]
    aging: ExceptionAging
    accountability: AccountabilityMetrics
}

export function computeExceptionAnalytics(
    exceptions: readonly PolicyException[],
    heatmaps: readonly HeatmapCell[],
    now: Date = new Date()
): ExceptionAnalyticsOutput {

    // 1. Global Metrics
    const active = exceptions.filter(e => new Date(e.timeBox.expiresAt) > now)
    const expired = exceptions.filter(e => new Date(e.timeBox.expiresAt) <= now)

    const durations = exceptions.map(e => {
        const start = new Date(e.timeBox.issuedAt)
        const end = new Date(e.timeBox.expiresAt)
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    })

    // 2. Risk Weighted Load
    const totalRiskScore = heatmaps.reduce((acc, c) => acc + c.severityScore, 0)
    const byScenarioClass: Record<string, number> = {}
    const byChangeType: Record<string, number> = {}

    heatmaps.forEach(c => {
        byScenarioClass[c.scenarioClass] = (byScenarioClass[c.scenarioClass] || 0) + c.severityScore
        byChangeType[c.changeType] = (byChangeType[c.changeType] || 0) + c.severityScore
    })

    // 3. Hotspots & Aging
    const aging: ExceptionAging = { under3Days: 0, days3to7: 0, days7to14: 0, expired: expired.length }
    const scenarioCounts: Record<string, { count: number, risk: number }> = {}

    exceptions.forEach(e => {
        const expires = new Date(e.timeBox.expiresAt)
        const ageDays = (expires.getTime() - new Date(e.timeBox.issuedAt).getTime()) / (1000 * 60 * 60 * 24)

        if (expires > now) {
            if (ageDays <= 3) aging.under3Days++
            else if (ageDays <= 7) aging.days3to7++
            else aging.days7to14++
        }

        // Hotspot data aggregation
        if (e.scope.scenarios) {
            e.scope.scenarios.forEach(sid => {
                if (!scenarioCounts[sid]) scenarioCounts[sid] = { count: 0, risk: 0 }
                scenarioCounts[sid]!.count++
            })
        }
    })

    const hotspots: ExceptionHotspot[] = Object.entries(scenarioCounts).map(([id, stats]) => ({
        dimension: "scenario",
        id,
        exceptionCount: stats.count,
        cumulativeRisk: stats.risk,
        repeated: stats.count >= 3
    }))

    return {
        global: {
            activeExceptions: active.length,
            expiredExceptions: expired.length,
            averageDurationDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            maxDurationDays: durations.length ? Math.max(...durations) : 0,
            exceptionVelocity: active.length // simplified for demo
        },
        riskLoad: {
            totalRiskScore,
            byScenarioClass: byScenarioClass as any,
            byChangeType: byChangeType as any
        },
        hotspots,
        aging,
        accountability: {
            byRequester: {},
            byApprover: {},
            repeatedPairs: []
        }
    }
}
