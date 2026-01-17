import { ScenarioConfidenceBand, ScenarioThresholds, ScenarioAnalyticsSnapshot, calculateScenarioConfidenceBand, Projection } from "./escalations"
import { ScenarioClass } from "../../test/golden/types"

export type MitigationEffectValue = {
    type: "rate-reduction" | "rate-inversion" | "cap"
    value: number
}

export type MitigationEffect = {
    metric: "riskScore" | "activeExceptions" | "aging7to14"
    effect: MitigationEffectValue
}

export type MitigationImpactInput = {
    scenarioId: string
    scenarioClass: ScenarioClass
    history: readonly ScenarioAnalyticsSnapshot[]
    current: ScenarioAnalyticsSnapshot
    effects: readonly MitigationEffect[]
    horizonDays: number
    thresholds?: ScenarioThresholds
}


export type MitigationImpactResult = {
    scenarioId: string
    mitigationRef: string
    baselineBands: ScenarioConfidenceBand
    postMitigationBands: ScenarioConfidenceBand
    verdict: "sufficient" | "insufficient" | "risk-shifted"
    explanation: string
}

export function simulateMitigationImpact(
    input: MitigationImpactInput,
    mitigationRef: string
): MitigationImpactResult {
    const { scenarioId, scenarioClass, history, current, effects, horizonDays } = input

    // 1. Calculate Baseline Bands
    // If thresholds are provided in input, we use them for the simulation
    const baselineBands = calculateScenarioConfidenceBand(scenarioId, scenarioClass, history, current, horizonDays)
    if (input.thresholds) {
        baselineBands.bands.forEach(b => {
            const t = input.thresholds![b.metric]
            if (t !== undefined) {
                b.threshold = t
                b.breach = {
                    best: b.bestCase.projectedValue >= t,
                    expected: b.expectedCase.projectedValue >= t,
                    worst: b.worstCase.projectedValue >= t
                }
            }
        })
    }


    // 2. Derive Post-Mitigation Bands
    // We apply the effects to the rates used in the bands
    const postMitigationBands: ScenarioConfidenceBand = {
        ...baselineBands,
        bands: baselineBands.bands.map(b => {
            const effect = effects.find(e => e.metric === b.metric)
            if (!effect) return b

            const apply = (proj: Projection): Projection => {
                let newRate = proj.rateUsed
                if (effect.effect.type === "rate-reduction") {
                    newRate = newRate - effect.effect.value
                } else if (effect.effect.type === "rate-inversion") {
                    newRate = -Math.abs(effect.effect.value)
                }

                let newVal = b.expectedCase.projectedValue - (b.expectedCase.rateUsed * horizonDays) + (newRate * horizonDays)
                if (effect.effect.type === "cap") {
                    newVal = Math.min(newVal, effect.effect.value)
                }

                return {
                    projectedValue: newVal,
                    projectedDate: proj.projectedDate,
                    rateUsed: newRate
                }
            }

            const newBest = apply(b.bestCase)
            const newExpected = apply(b.expectedCase)
            const newWorst = apply(b.worstCase)

            return {
                ...b,
                bestCase: newBest,
                expectedCase: newExpected,
                worstCase: newWorst,
                breach: {
                    best: newBest.projectedValue >= b.threshold,
                    expected: newExpected.projectedValue >= b.threshold,
                    worst: newWorst.projectedValue >= b.threshold
                }
            }
        })
    }

    // 3. Determine Verdict
    const baselineHasBreach = baselineBands.bands.some(b => b.breach.best || b.breach.expected || b.breach.worst)
    const postHasBreach = postMitigationBands.bands.some(b => b.breach.best || b.breach.expected || b.breach.worst)

    let verdict: MitigationImpactResult["verdict"] = "insufficient"
    let explanation = ""

    if (!postHasBreach) {
        verdict = "sufficient"
        explanation = "Post-mitigation bands clear all thresholds."
    } else {
        const remainingBreaches = postMitigationBands.bands.filter(b => b.breach.best || b.breach.expected || b.breach.worst)
        explanation = `Remaining breaches in: ${remainingBreaches.map(b => b.metric).join(", ")}`

        // Check for risk-shift: original breach resolved but new one appeared
        const originalBreachedMetrics = baselineBands.bands.filter(b => b.breach.best || b.breach.expected || b.breach.worst).map(b => b.metric)
        const postBreachedMetrics = postMitigationBands.bands.filter(b => b.breach.best || b.breach.expected || b.breach.worst).map(b => b.metric)

        const isShifted = postBreachedMetrics.some(m => !originalBreachedMetrics.includes(m))
        if (isShifted) {
            verdict = "risk-shifted"
            explanation += ". New risk areas detected."
        }
    }

    return {
        scenarioId,
        mitigationRef,
        baselineBands,
        postMitigationBands,
        verdict,
        explanation
    }
}
export type MitigationPattern = {
    id: string
    name: string
    applicableTo: readonly ScenarioClass[]
    description: string
    declaredEffects: readonly MitigationEffect[]
    costModel: {
        implementationEffort: 1 | 2 | 3 | 4 | 5
        operationalRisk: 1 | 2 | 3 | 4 | 5
    }
    constraints?: readonly string[]
}

export const CanonicalMitigationCatalog: MitigationPattern[] = [
    {
        id: "MIT-CLAMP-INVARIANT",
        name: "Clamp invariant at transition boundary",
        applicableTo: ["blocking-violation", "failure-mode"],
        description: "Enforces strict bounds on state transitions to prevent drift.",
        declaredEffects: [
            {
                metric: "riskScore",
                effect: { type: "rate-inversion", value: 1 }
            }
        ],
        costModel: {
            implementationEffort: 2,
            operationalRisk: 1
        }
    },
    {
        id: "MIT-DISABLE-SCENARIO",
        name: "Quarantine scenario from release gating",
        applicableTo: ["failure-mode", "edge-case"],
        description: "Separates the scenario from main gating tracks for isolation.",
        declaredEffects: [
            {
                metric: "activeExceptions",
                effect: { type: "cap", value: 0 }
            }
        ],
        costModel: {
            implementationEffort: 1,
            operationalRisk: 4
        }
    }
]

export type MitigationScore = {
    impactScore: number
    timeScore: number
    safetyScore: number
    costScore: number
    totalScore: number
}

export type MitigationSuggestion = {
    rank: number
    patternId: string
    name: string
    scores: MitigationScore
    misSummary: {
        verdict: "sufficient" | "insufficient" | "risk-shifted"
        clearedMetrics: ("riskScore" | "activeExceptions" | "aging7to14")[]
        remainingRisks?: ("riskScore" | "activeExceptions" | "aging7to14")[]
    }
    tradeOffs: {
        implementationEffort: number
        operationalRisk: number
        notes?: string[]
    }
}

export function rankMitigationSuggestions(
    input: Omit<MitigationImpactInput, "effects">,
    catalog: readonly MitigationPattern[] = CanonicalMitigationCatalog
): MitigationSuggestion[] {
    const evaluations: { pattern: MitigationPattern; result: MitigationImpactResult }[] = []

    for (const pattern of catalog) {
        if (pattern.applicableTo.includes(input.scenarioClass)) {
            const result = simulateMitigationImpact({
                ...input,
                effects: pattern.declaredEffects
            }, pattern.id)
            evaluations.push({ pattern, result })
        }
    }

    const suggestions: MitigationSuggestion[] = evaluations.map(ev => {
        const { pattern, result } = ev

        const metric = "riskScore"
        const baselineWorst = result.baselineBands.bands.find(b => b.metric === metric)?.worstCase.projectedValue || 0
        const postWorst = result.postMitigationBands.bands.find(b => b.metric === metric)?.worstCase.projectedValue || 0
        const impactScore = result.verdict === "sufficient" ? Math.max(0, baselineWorst - postWorst) : 0

        const timeScore = input.horizonDays
        const safetyScore = 6 - pattern.costModel.operationalRisk
        const costScore = 6 - pattern.costModel.implementationEffort

        const totalScore = (impactScore * 0.5) + (timeScore * 0.2) + (safetyScore * 0.2) + (costScore * 0.1)

        const clearedMetrics = result.baselineBands.bands
            .filter(b => (b.breach.best || b.breach.expected || b.breach.worst))
            .filter(b => {
                const post = result.postMitigationBands.bands.find(pb => pb.metric === b.metric)
                return post && !post.breach.best && !post.breach.expected && !post.breach.worst
            })
            .map(b => b.metric as "riskScore" | "activeExceptions" | "aging7to14")

        return {
            rank: 0,
            patternId: pattern.id,
            name: pattern.name,
            scores: { impactScore, timeScore, safetyScore, costScore, totalScore },
            misSummary: {
                verdict: result.verdict,
                clearedMetrics,
                remainingRisks: result.verdict !== "sufficient"
                    ? result.postMitigationBands.bands.filter(b => b.breach.worst).map(b => b.metric as "riskScore" | "activeExceptions" | "aging7to14")
                    : undefined
            },
            tradeOffs: {
                implementationEffort: pattern.costModel.implementationEffort,
                operationalRisk: pattern.costModel.operationalRisk
            }
        }
    })

    return suggestions
        .sort((a, b) => b.scores.totalScore - a.scores.totalScore)
        .map((s, i) => ({ ...s, rank: i + 1 }))
}

// --- Rollback Impact Simulation (RIS) ---

export type RollbackImpactInput = {
    scenarioId: string
    scenarioClass: ScenarioClass
    currentVersion: string
    rollbackTarget: {
        version: string
        targetRates: Record<"riskScore" | "activeExceptions" | "aging7to14", number>
    }
    history: readonly ScenarioAnalyticsSnapshot[]
    current: ScenarioAnalyticsSnapshot
    horizonDays: number
}

export type RollbackImpactResult = {
    scenarioId: string
    rollbackTargetVersion: string
    baselineBands: ScenarioConfidenceBand
    postRollbackBands: ScenarioConfidenceBand
    verdict: "sufficient" | "insufficient" | "regressive"
    explanation: string
}

export function simulateRollbackImpact(input: RollbackImpactInput): RollbackImpactResult {
    const { scenarioId, scenarioClass, history, current, horizonDays, rollbackTarget } = input

    const baselineBands = calculateScenarioConfidenceBand(scenarioId, scenarioClass, history, current, horizonDays)

    const postRollbackBands: ScenarioConfidenceBand = {
        ...baselineBands,
        bands: baselineBands.bands.map(b => {
            const targetRate = rollbackTarget.targetRates[b.metric]

            const project = (rate: number): Projection => ({
                projectedValue: current[b.metric] + rate * horizonDays,
                projectedDate: b.expectedCase.projectedDate,
                rateUsed: rate
            })

            const newExpected = project(targetRate)
            return {
                ...b,
                bestCase: project(targetRate * 0.8),
                expectedCase: newExpected,
                worstCase: project(targetRate * 1.2),
                breach: {
                    best: (current[b.metric] + targetRate * 0.8 * horizonDays) >= b.threshold,
                    expected: (current[b.metric] + targetRate * horizonDays) >= b.threshold,
                    worst: (current[b.metric] + targetRate * 1.2 * horizonDays) >= b.threshold
                }
            }
        })
    }

    const postHasBreach = postRollbackBands.bands.some(b => b.breach.best || b.breach.expected || b.breach.worst)
    let verdict: RollbackImpactResult["verdict"] = postHasBreach ? "insufficient" : "sufficient"

    return {
        scenarioId,
        rollbackTargetVersion: rollbackTarget.version,
        baselineBands,
        postRollbackBands,
        verdict,
        explanation: verdict === "sufficient" ? "Rollback clears all bands." : "Rollback insufficient."
    }
}

// --- Hybrid Analysis (RFHA) ---

export type HybridStrategy = {
    kind: "rollback-only" | "forward-only" | "rollback-then-forward"
    rollbackVersion?: string
    mitigationPatternId?: string
}

export type HybridAnalysisResult = {
    strategyId: string
    strategy: HybridStrategy
    verdict: "sufficient" | "temporarily-safe" | "insufficient" | "regressive"
    scores: {
        impactScore: number
        timeToSafety: number
        regressionRisk: number
        totalScore: number
    }
}

// --- Playbooks ---

export type HybridStrategyPlaybook = {
    id: string
    name: string
    applicableTo: {
        scenarioClasses: readonly ScenarioClass[]
    }
}

export const CanonicalPlaybookCatalog: HybridStrategyPlaybook[] = [
    {
        id: "PB-STAB-001",
        name: "Stabilize then fix invariant",
        applicableTo: { scenarioClasses: ["blocking-violation"] }
    }
]

export type WhatIfRow = {
    patternId: string
    name: string
    verdict: "sufficient" | "insufficient" | "risk-shifted"
    clearance: {
        clearsRiskScore: boolean
        clearsActiveExceptions: boolean
        clearsAging: boolean
        daysToClear: number | null
    }
    projections: {
        worstCase: number
        expectedCase: number
        bestCase: number
    }
    residualRisks: readonly {
        metric: string
        description: string
    }[]
    cost: {
        implementationEffort: number
        operationalRisk: number
    }
    score: number
}

export type DecisionReadiness = "ready-to-close-sla" | "needs-governance-review" | "insufficient"

export function compareMitigations(
    input: Omit<MitigationImpactInput, "effects">,
    catalog: readonly MitigationPattern[] = CanonicalMitigationCatalog
): { rows: WhatIfRow[]; readiness: Record<string, DecisionReadiness> } {
    const suggestions = rankMitigationSuggestions(input, catalog)
    const readiness: Record<string, DecisionReadiness> = {}

    const rows: WhatIfRow[] = suggestions.map(s => {
        const pattern = catalog.find(p => p.id === s.patternId)!
        const mis = simulateMitigationImpact({ ...input, effects: pattern.declaredEffects }, pattern.id)

        const riskProj = mis.postMitigationBands.bands.find(b => b.metric === "riskScore")!
        const excProj = mis.postMitigationBands.bands.find(b => b.metric === "activeExceptions")!
        const agingProj = mis.postMitigationBands.bands.find(b => b.metric === "aging7to14")!

        const residualRisks: { metric: string; description: string }[] = []
        mis.postMitigationBands.bands.forEach(b => {
            if (b.breach.worst) {
                residualRisks.push({ metric: b.metric, description: "Worst-case breach remains" })
            }
        })

        if (mis.verdict === "sufficient" && residualRisks.length === 0) {
            readiness[s.patternId] = "ready-to-close-sla"
        } else if (mis.verdict === "risk-shifted") {
            readiness[s.patternId] = "needs-governance-review"
        } else {
            readiness[s.patternId] = "insufficient"
        }

        return {
            patternId: s.patternId,
            name: s.name,
            verdict: mis.verdict,
            clearance: {
                clearsRiskScore: !riskProj.breach.worst,
                clearsActiveExceptions: !excProj.breach.worst,
                clearsAging: !agingProj.breach.worst,
                daysToClear: mis.verdict === "sufficient" ? 0 : null // Simplified
            },
            projections: {
                worstCase: riskProj.worstCase.projectedValue,
                expectedCase: riskProj.expectedCase.projectedValue,
                bestCase: riskProj.bestCase.projectedValue
            },
            residualRisks,
            cost: {
                implementationEffort: pattern.costModel.implementationEffort,
                operationalRisk: pattern.costModel.operationalRisk
            },
            score: s.scores.totalScore
        }
    })

    return { rows, readiness }
}


