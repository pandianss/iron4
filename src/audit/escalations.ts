import { ExceptionAnalyticsOutput, ExceptionAging, RiskWeightedLoad, GlobalExceptionMetrics, ExceptionHotspot, ChangeType } from "./analytics"
import { ScenarioClass } from "../../test/golden/types"



export type EscalationTrigger =
    | "exception-accumulation"
    | "exception-aging"
    | "risk-score-threshold"
    | "repeated-scope"
    | "incident-correlation"

export type EscalationLevel =
    | "notify"
    | "require-review"
    | "require-governance-approval"
    | "freeze-release"

export type EscalationAction =
    | "notify-tech-lead"
    | "notify-risk-owner"
    | "notify-governance-board"
    | "tighten-release-gate"
    | "open-mandatory-review"
    | "mandate-design-review"
    | "block-ci"
    | "escalate-to-executive"
    | "incident-review-required"

export type AutoEscalationRule = {
    id: string
    trigger: EscalationTrigger
    condition: (metrics: ExceptionAnalyticsOutput) => boolean
    escalation: EscalationLevel
    actions: readonly EscalationAction[]
}

export type ExceptionAnalyticsSnapshot = {
    timestamp: string
    global: GlobalExceptionMetrics
    riskLoad: RiskWeightedLoad
    aging: ExceptionAging
    hotspots: readonly ExceptionHotspot[]
}

export type PredictiveInput = {
    history: readonly ExceptionAnalyticsSnapshot[]
    current: ExceptionAnalyticsSnapshot
    horizonDays: number
}

export type PredictiveSignal =
    | "velocity-increase"
    | "risk-acceleration"
    | "aging-drift"
    | "hotspot-recurrence"
    | "time-to-breach"

export type PredictiveEscalationLevel =
    | "early-warning"
    | "pre-review"
    | "pre-freeze"

export type PredictiveEscalationRule = {
    id: string
    signal: PredictiveSignal
    condition: (input: PredictiveInput) => boolean
    level: PredictiveEscalationLevel
    actions: readonly EscalationAction[]
}

export type Projection = {
    projectedValue: number
    projectedDate: string
    rateUsed: number
}

export type ConfidenceBand = {
    metric: "riskScore" | "activeExceptions" | "aging7to14"
    horizonDays: number
    bestCase: Projection
    expectedCase: Projection
    worstCase: Projection
    breachAssessment: {
        threshold: number
        bestCaseBreaches: boolean
        expectedCaseBreaches: boolean
        worstCaseBreaches: boolean
    }
}

export type ScenarioThresholds = {
    riskScore: number
    activeExceptions: number
    aging7to14: number
}

export const ScenarioThresholdMatrix: Record<ScenarioClass, ScenarioThresholds> = {
    "happy-path": { riskScore: 5, activeExceptions: 1, aging7to14: 0 },
    "warning-escalation": { riskScore: 8, activeExceptions: 2, aging7to14: 0 },
    "blocking-violation": { riskScore: 10, activeExceptions: 1, aging7to14: 0 },
    "max-ticks-termination": { riskScore: 5, activeExceptions: 1, aging7to14: 0 },
    "stability-termination": { riskScore: 5, activeExceptions: 1, aging7to14: 0 },
    "edge-case": { riskScore: 10, activeExceptions: 1, aging7to14: 0 },
    "failure-mode": { riskScore: 0, activeExceptions: 0, aging7to14: 0 }
}

export type ScenarioAnalyticsSnapshot = {
    timestamp: string
    riskScore: number
    activeExceptions: number
    aging7to14: number
}

export type ScenarioConfidenceBand = {
    scenarioId: string
    scenarioClass: ScenarioClass
    horizonDays: number
    bands: {
        metric: "riskScore" | "activeExceptions" | "aging7to14"
        bestCase: Projection
        expectedCase: Projection
        worstCase: Projection
        threshold: number
        breach: { best: boolean; expected: boolean; worst: boolean }
    }[]
    requiredEscalation: PredictiveEscalationLevel | "none"
}

export type ScenarioSLASeverity = "none" | "warning" | "critical" | "blocking"

export const SLATimeboxes: Record<ScenarioSLASeverity, number> = {
    none: Infinity,
    warning: 5,
    critical: 2,
    blocking: 0
}

export type ScenarioSLA = {
    scenarioId: string
    severity: ScenarioSLASeverity
    triggeredAt: string
    dueBy: string
    ownerId: string
    status: "open" | "resolved" | "breached"
    mitigationRef?: string
    mitigationVerdict?: "sufficient" | "insufficient" | "risk-shifted"
}


export type ScenarioOwner = {
    scenarioId: string
    ownerId: string
    team: string
}





export const CanonicalEscalationRules: AutoEscalationRule[] = [
    {
        id: "EX-ACC-002",
        trigger: "exception-accumulation",
        condition: m => m.global.activeExceptions >= 10,
        escalation: "freeze-release",
        actions: ["notify-governance-board"]
    },
    {
        id: "EX-AGE-001",
        trigger: "exception-aging",
        condition: m => m.aging.days7to14 > 0,
        escalation: "require-governance-approval",
        actions: ["open-mandatory-review"]
    },
    {
        id: "EX-AGE-002",
        trigger: "exception-aging",
        condition: m => m.aging.expired > 0,
        escalation: "freeze-release",
        actions: ["block-ci"]
    },
    {
        id: "EX-RISK-001",
        trigger: "risk-score-threshold",
        condition: m => m.riskLoad.totalRiskScore >= 50,
        escalation: "require-governance-approval",
        actions: ["tighten-release-gate"]
    },
    {
        id: "EX-REP-001",
        trigger: "repeated-scope",
        condition: m => m.hotspots.some(h => h.repeated),
        escalation: "require-governance-approval",
        actions: ["mandate-design-review"]
    }
]

export const CanonicalPredictiveRules: PredictiveEscalationRule[] = [
    {
        id: "PRED-001",
        signal: "time-to-breach",
        condition: i => {
            const rate = calculateRiskSlope(i.history, i.current)
            if (rate <= 0) return false
            const timeToBreach = (80 - i.current.riskLoad.totalRiskScore) / rate
            return timeToBreach <= i.horizonDays
        },
        level: "pre-freeze",
        actions: ["notify-governance-board", "tighten-release-gate"]
    }
]

function calculateRiskSlope(history: readonly ExceptionAnalyticsSnapshot[], current: ExceptionAnalyticsSnapshot): number {
    if (history.length === 0) return 0
    const previous = history[history.length - 1]!
    const riskDiff = current.riskLoad.totalRiskScore - previous.riskLoad.totalRiskScore
    const timeDiffRaw = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()
    const days = timeDiffRaw / (1000 * 60 * 60 * 24)
    return days > 0 ? riskDiff / days : 0
}

const ScenarioClassMap: Record<string, ScenarioClass> = {
    "energy-happy": "happy-path",
    "energy-blocking": "blocking-violation",
    "fail-governance-after-migration": "failure-mode"
}

export function calculateScenarioConfidenceBand(
    scenarioId: string,
    scenarioClass: ScenarioClass,
    history: readonly ScenarioAnalyticsSnapshot[],
    current: ScenarioAnalyticsSnapshot,
    horizonDays: number
): ScenarioConfidenceBand {
    const thresholds = ScenarioThresholdMatrix[scenarioClass]
    const bands: ScenarioConfidenceBand["bands"] = []

    const metrics: ("riskScore" | "activeExceptions" | "aging7to14")[] = ["riskScore", "activeExceptions", "aging7to14"]

    for (const metric of metrics) {
        const threshold = thresholds[metric]
        const dailyRates: number[] = []
        const snapshots = [...history, current]

        for (let i = 1; i < snapshots.length; i++) {
            const prev = snapshots[i - 1]!
            const curr = snapshots[i]!
            const days = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60 * 60 * 24)
            if (days > 0) dailyRates.push((curr[metric] - prev[metric]) / days)
        }

        const bestRate = dailyRates.length > 0 ? Math.min(...dailyRates) : 0
        const expectedRate = dailyRates.length > 0 ? dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length : 0
        const worstRate = dailyRates.length > 0 ? Math.max(...dailyRates) : 0

        const project = (rate: number): Projection => ({
            projectedValue: current[metric] + rate * horizonDays,
            projectedDate: new Date(new Date(current.timestamp).getTime() + horizonDays * 1000 * 60 * 60 * 24).toISOString(),
            rateUsed: rate
        })

        const bestCase = project(bestRate)
        const expectedCase = project(expectedRate)
        const worstCase = project(worstRate)

        bands.push({
            metric,
            bestCase,
            expectedCase,
            worstCase,
            threshold,
            breach: {
                best: bestCase.projectedValue >= threshold,
                expected: expectedCase.projectedValue >= threshold,
                worst: worstCase.projectedValue >= threshold
            }
        })
    }

    let requiredEscalation: PredictiveEscalationLevel | "none" = "none"
    if (scenarioClass === "failure-mode" && bands.some(b => b.breach.best || b.breach.expected || b.breach.worst)) {
        requiredEscalation = "pre-freeze"
    } else if (bands.some(b => b.breach.best)) {
        requiredEscalation = "pre-freeze"
    } else if (bands.some(b => b.breach.expected)) {
        requiredEscalation = "pre-review"
    } else if (bands.some(b => b.breach.worst)) {
        requiredEscalation = "early-warning"
    }

    return { scenarioId, scenarioClass, horizonDays, bands, requiredEscalation }
}


export function calculateConfidenceBand(
    metrics: "riskScore" | "activeExceptions" | "aging7to14",
    threshold: number,
    input: PredictiveInput
): ConfidenceBand {
    const { history, current, horizonDays } = input

    // 1. Compute Daily Rates from history
    const dailyRates: number[] = []
    const snapshots = [...history, current]

    for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1]!
        const curr = snapshots[i]!

        let valCurr: number, valPrev: number
        if (metrics === "riskScore") { valCurr = curr.riskLoad.totalRiskScore; valPrev = prev.riskLoad.totalRiskScore }
        else if (metrics === "activeExceptions") { valCurr = curr.global.activeExceptions; valPrev = prev.global.activeExceptions }
        else { valCurr = curr.aging.days7to14; valPrev = prev.aging.days7to14 }

        const days = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60 * 60 * 24)
        if (days > 0) dailyRates.push((valCurr - valPrev) / days)
    }

    // 2. Define Rates
    const bestRate = dailyRates.length > 0 ? Math.min(...dailyRates) : 0
    const expectedRate = dailyRates.length > 0 ? dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length : 0
    const worstRate = dailyRates.length > 0 ? Math.max(...dailyRates) : 0

    const currentValue = metrics === "riskScore" ? current.riskLoad.totalRiskScore
        : metrics === "activeExceptions" ? current.global.activeExceptions
            : current.aging.days7to14

    const project = (rate: number): Projection => ({
        projectedValue: currentValue + rate * horizonDays,
        projectedDate: new Date(new Date(current.timestamp).getTime() + horizonDays * 1000 * 60 * 60 * 24).toISOString(),
        rateUsed: rate
    })

    const bestCase = project(bestRate)
    const expectedCase = project(expectedRate)
    const worstCase = project(worstRate)

    return {
        metric: metrics,
        horizonDays,
        bestCase,
        expectedCase,
        worstCase,
        breachAssessment: {
            threshold,
            bestCaseBreaches: bestCase.projectedValue >= threshold,
            expectedCaseBreaches: expectedCase.projectedValue >= threshold,
            worstCaseBreaches: worstCase.projectedValue >= threshold
        }
    }
}


export type EscalationState = {
    level: EscalationLevel | PredictiveEscalationLevel
    activeRules: string[]
    actions: EscalationAction[]
    openSLAs: ScenarioSLA[]
}

export function evaluateEscalations(
    metrics: ExceptionAnalyticsOutput,
    rules: AutoEscalationRule[],
    predictiveRules: PredictiveEscalationRule[] = [],
    history: ExceptionAnalyticsSnapshot[] = [],
    scenarioHistories: Record<string, ScenarioAnalyticsSnapshot[]> = {},
    existingSLAs: ScenarioSLA[] = [],
    mitigationResults: Record<string, "sufficient" | "insufficient" | "risk-shifted"> = {},
    now: Date = new Date()
): EscalationState {


    let maxLevel: EscalationLevel | PredictiveEscalationLevel = "notify"
    const activeRules: string[] = []
    const actionsSet = new Set<EscalationAction>()
    const newSLAs: ScenarioSLA[] = []

    const levelsOrder: (EscalationLevel | PredictiveEscalationLevel)[] = [

        "notify",
        "early-warning",
        "pre-review",
        "require-review",
        "pre-freeze",
        "require-governance-approval",
        "freeze-release"
    ]

    const updateMaxLevel = (level: EscalationLevel | PredictiveEscalationLevel) => {
        const currentLevelIndex = levelsOrder.indexOf(level)
        const maxLevelIndex = levelsOrder.indexOf(maxLevel)

        if (currentLevelIndex > maxLevelIndex) {
            maxLevel = level
        }
    }

    // Evaluate Reactive Rules
    for (const rule of rules) {
        if (rule.condition(metrics)) {
            activeRules.push(rule.id)
            rule.actions.forEach(a => actionsSet.add(a))
            updateMaxLevel(rule.escalation)
        }
    }

    // Evaluate Predictive Rules
    if (history.length > 0) {
        const predInput: PredictiveInput = {
            history,
            current: {
                timestamp: now.toISOString(),
                global: metrics.global,
                riskLoad: metrics.riskLoad,
                aging: metrics.aging,
                hotspots: metrics.hotspots
            },
            horizonDays: 7
        }


        for (const rule of predictiveRules) {
            if (rule.condition(predInput)) {
                activeRules.push(rule.id)
                rule.actions.forEach(a => actionsSet.add(a))
                updateMaxLevel(rule.level)
            }
        }
    }

    // Evaluate Scenario-Specific Bands
    for (const [scenarioId, sHistory] of Object.entries(scenarioHistories)) {
        const scenarioMetric = metrics.hotspots.find(h => h.id === scenarioId)
        if (!scenarioMetric) continue

        const currentSnapshot: ScenarioAnalyticsSnapshot = {
            timestamp: now.toISOString(),
            riskScore: scenarioMetric.cumulativeRisk,
            activeExceptions: scenarioMetric.exceptionCount,
            aging7to14: 0 // Simplification for demo
        }

        const scenarioClass = ScenarioClassMap[scenarioId] || "happy-path"
        const band = calculateScenarioConfidenceBand(scenarioId, scenarioClass, sHistory, currentSnapshot, 7)

        if (band.requiredEscalation !== "none") {
            const verdict = mitigationResults[scenarioId]
            if (verdict === "sufficient") {
                // Mitigation proven sufficient, do not escalate/trigger new SLA
                continue
            }

            updateMaxLevel(band.requiredEscalation)
            activeRules.push(`SCENARIO-BAND-${scenarioId}`)
            actionsSet.add("notify-risk-owner")

            // SLA Triggering
            const severity = mapEscalationToSeverity(band.requiredEscalation)
            const existing = existingSLAs.find(s => s.scenarioId === scenarioId && s.status === "open")
            if (!existing || isSeverityHigher(severity, existing.severity)) {
                const dueBy = new Date(now.getTime() + SLATimeboxes[severity] * 24 * 60 * 60 * 1000).toISOString()
                newSLAs.push({
                    scenarioId,
                    severity,
                    triggeredAt: now.toISOString(),
                    dueBy,
                    ownerId: "auto-assigned", // In real system, lookup from ScenarioOwnerRegistry
                    status: "open"
                })
            }
        }
    }

    let openSLAs = [...existingSLAs.filter(s => s.status === "open"), ...newSLAs]

    // Process Resolutions
    openSLAs = openSLAs.map(sla => {
        const verdict = mitigationResults[sla.scenarioId]
        if (verdict === "sufficient") {
            return { ...sla, status: "resolved", mitigationVerdict: verdict } as ScenarioSLA
        }
        return sla
    })

    const finalOpenSLAs = openSLAs.filter(s => s.status === "open")

    // Check for SLA breaches
    for (const sla of finalOpenSLAs) {
        if (new Date(sla.dueBy) < now) {
            sla.status = "breached"
            updateMaxLevel("freeze-release")
            activeRules.push(`SLA-BREACH-${sla.scenarioId}`)
            actionsSet.add("block-ci")
        }
    }

    return {
        level: maxLevel,
        activeRules,
        actions: Array.from(actionsSet),

        openSLAs
    }
}

function mapEscalationToSeverity(esc: PredictiveEscalationLevel): ScenarioSLASeverity {
    if (esc === "pre-freeze") return "blocking"
    if (esc === "pre-review") return "critical"
    return "warning"
}

function isSeverityHigher(a: ScenarioSLASeverity, b: ScenarioSLASeverity): boolean {
    const order: ScenarioSLASeverity[] = ["none", "warning", "critical", "blocking"]
    return order.indexOf(a) > order.indexOf(b)
}


