import { ScenarioId } from "./coupling"

export type FaultType = "latency" | "policy-misfire" | "state-perturbation" | "transition-drop"

export type FaultInjection = {
    type: FaultType
    target: ScenarioId
    magnitude: number
    durationSeconds: number
}

export type ChaosVerdict = "validated" | "unexpected-coupling" | "governance-gap" | "safety-breach"

export type ChaosExperimentResult = {
    experimentId: string
    observedCascade: {
        scenarios: readonly ScenarioId[]
        depth: number
    }
    verdict: ChaosVerdict
    findings: readonly string[]
}

export type ConfidenceGrade = "A" | "B" | "C" | "D" | "F"

export type ChaosConfidenceScore = {
    scenarioId: string
    score: number // 0–100
    grade: ConfidenceGrade
    lastUpdated: string
}

export function calculateGrade(score: number): ConfidenceGrade {
    if (score >= 90) return "A"
    if (score >= 75) return "B"
    if (score >= 60) return "C"
    if (score >= 40) return "D"
    return "F"
}

export type ChaosExperimentPlan = {
    scenarioId: string
    scheduledAt: string
    intensity: "light" | "moderate" | "deep"
    justification: string
}

/**
 * CDCS: Confidence-Driven Chaos Scheduling
 */
export function scheduleChaos(
    scenarios: { scenarioId: string; confidence: number; centrality: number }[],
    upcomingRelease: boolean
): ChaosExperimentPlan[] {
    const plans: ChaosExperimentPlan[] = scenarios.map(s => {
        // Priority = (1 - confidence/100) * 0.6 + centrality * 0.4
        let priority = ((1 - s.confidence / 100) * 0.6) + (s.centrality * 0.4)
        if (upcomingRelease) priority *= 1.5

        let intensity: "light" | "moderate" | "deep" = "light"
        if (priority > 0.7) intensity = "deep"
        else if (priority > 0.4) intensity = "moderate"

        return {
            scenarioId: s.scenarioId,
            scheduledAt: new Date().toISOString(),
            intensity,
            justification: `Priority score ${priority.toFixed(2)} based on confidence ${s.confidence} and centrality ${s.centrality.toFixed(2)}`
        }
    })

    return plans.sort((a, b) => {
        const pA = parseFloat(a.justification.split("score ")[1]!)
        const pB = parseFloat(b.justification.split("score ")[1]!)
        return pB - pA
    })
}

// --- Chaos Confidence Budgets ---

export type ChaosBudget = {
    totalUnits: number
    consumedUnits: number
    remainingUnits: number
    throttled: boolean
}

export type ChaosIntensity = "light" | "moderate" | "deep"

const IntensityCost: Record<ChaosIntensity, number> = {
    light: 1,
    moderate: 3,
    deep: 10
}

export function allocateBudget(
    availableUnits: number,
    plans: ChaosExperimentPlan[]
): { budget: ChaosBudget; approvedPlans: ChaosExperimentPlan[] } {
    let consumed = 0
    const approved: ChaosExperimentPlan[] = []

    for (const plan of plans) {
        const cost = IntensityCost[plan.intensity]
        if (consumed + cost <= availableUnits) {
            consumed += cost
            approved.push(plan)
        }
    }

    return {
        budget: {
            totalUnits: availableUnits,
            consumedUnits: consumed,
            remainingUnits: availableUnits - consumed,
            throttled: approved.length < plans.length
        },
        approvedPlans: approved
    }
}

// --- Chaos ROI Analytics ---

export type ExperimentROI = {
    experimentId: string
    scenarioId: string
    confidenceDelta: number
    pointsSpent: number
    roi: number
    verdict: ChaosVerdict
}

export type EfficiencyGrade = "A" | "B" | "C" | "D" | "F"

export function calculateROIGrade(roi: number): EfficiencyGrade {
    if (roi >= 4.0) return "A"
    if (roi >= 2.0) return "B"
    if (roi >= 1.0) return "C"
    if (roi >= 0.0) return "D"
    return "F"
}

export function calculateExperimentROI(
    experimentId: string,
    scenarioId: string,
    verdict: ChaosVerdict,
    intensity: ChaosIntensity,
    blastRadius: number = 1
): ExperimentROI {
    let confidenceDelta = 0
    if (verdict === "validated") confidenceDelta = 8
    else if (verdict === "unexpected-coupling") confidenceDelta = -10
    else if (verdict === "governance-gap") confidenceDelta = -15
    else if (verdict === "safety-breach") confidenceDelta = -25

    const pointsSpent = IntensityCost[intensity] + Math.max(0, blastRadius - 1)
    const roi = pointsSpent > 0 ? confidenceDelta / pointsSpent : 0

    return {
        experimentId,
        scenarioId,
        confidenceDelta,
        pointsSpent,
        roi,
        verdict
    }
}

export type PatternROI = {
    patternId: string
    averageROI: number
    usageCount: number
    shouldRetire: boolean
}

export function analyzePatternEffectiveness(
    patternId: string,
    results: ExperimentROI[]
): PatternROI {
    const patternResults = results.filter(r => r.experimentId.includes(patternId))
    const totalROI = patternResults.reduce((acc, r) => acc + r.roi, 0)
    const averageROI = patternResults.length > 0 ? totalROI / patternResults.length : 0

    return {
        patternId,
        averageROI,
        usageCount: patternResults.length,
        shouldRetire: patternResults.length >= 3 && averageROI < 0
    }
}
// --- Adaptive Budget Resizing ---

export type AdaptiveBudgetPolicy = {
    roiTargets: {
        excellent: number
        poor: number
    }
    resizeFactors: {
        grow: number
        shrink: number
        shrinkHard: number
    }
    bounds: {
        minBudget: number
        maxBudget: number
    }
}

/**
 * Adaptive Chaos Budget Resizing
 * Automatically expands or contracts budget based on ROI evidence.
 */
export function resizeBudget(
    currentBudgetLimit: number,
    averageROI: number,
    wasteRate: number,
    policy: AdaptiveBudgetPolicy
): number {
    let delta = 0

    // Grow if ROI is excellent and waste is low
    if (averageROI >= policy.roiTargets.excellent && wasteRate <= 20) {
        delta = policy.resizeFactors.grow
    }
    // Shrink if ROI is poor or waste is high
    else if (averageROI < policy.roiTargets.poor || wasteRate >= 40) {
        if (averageROI < (policy.roiTargets.poor / 2)) {
            delta = -policy.resizeFactors.shrinkHard
        } else {
            delta = -policy.resizeFactors.shrink
        }
    }

    const newLimit = currentBudgetLimit * (1 + delta)

    // Enforce policy bounds
    return Math.max(policy.bounds.minBudget, Math.min(policy.bounds.maxBudget, newLimit))
}

// --- Predictive Budget Forecasting (PCBF) ---

export type PredictiveBudgetPolicy = {
    targetConfidence: number
    roiExpectations: { optimistic: number; expected: number; pessimistic: number }
    halfLifeDays: number
    safetyMultipliers: { highCoupling: number; highReleaseRisk: number }
}

export type BudgetForecast = {
    scenarioId: string
    forecast: { optimistic: number; expected: number; pessimistic: number }
    justification: string
}

/**
 * Predictive Budget Forecasting
 * Anticipates chaos demand based on confidence decay and coupling risk.
 */
export function forecastBudgetDemand(
    scenarioId: string,
    currentConfidence: number,
    centrality: number,
    inHighRiskRelease: boolean,
    policy: PredictiveBudgetPolicy,
    daysAhead: number
): BudgetForecast {
    // 1. Forecast Decay
    const predictedConfidence = currentConfidence * Math.pow(0.5, daysAhead / policy.halfLifeDays)

    // 2. Identify Gap
    const gap = Math.max(0, policy.targetConfidence - predictedConfidence)

    // 3. Convert Gap to Points using ROI bands
    const project = (roi: number) => {
        let points = gap / roi
        if (centrality > 0.6) points *= policy.safetyMultipliers.highCoupling
        if (inHighRiskRelease) points *= policy.safetyMultipliers.highReleaseRisk
        return Math.ceil(points)
    }

    return {
        scenarioId,
        forecast: {
            optimistic: project(policy.roiExpectations.optimistic),
            expected: project(policy.roiExpectations.expected),
            pessimistic: project(policy.roiExpectations.pessimistic)
        },
        justification: `Forecasted for ${daysAhead} days. Decay baseline ${predictedConfidence.toFixed(1)}. Confidence gap ${gap.toFixed(1)}.`
    }
}

