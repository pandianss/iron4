import { describe, it, expect } from "vitest"
import { computeExceptionAnalytics } from "../../src/audit/analytics"
import { evaluateEscalations, CanonicalEscalationRules, calculateConfidenceBand } from "../../src/audit/escalations"
import { simulateMitigationImpact, rankMitigationSuggestions } from "../../src/audit/mitigation"


import { evaluateReleaseGate, DefaultReleaseGatePolicy } from "../../src/audit/gating"
import { PolicyException } from "../../src/audit/exceptions"
import { HeatmapCell } from "../../src/audit/heatmap"

describe("Auto-Escalation Governance Loop", () => {
    it("freezes release when active exceptions exceed threshold", () => {
        // 1. Setup 10 active exceptions (threshold for freeze)
        const baseException: PolicyException = {
            id: "EXP-1",
            title: "Test",
            description: "Test",
            scope: { scenarios: ["energy-happy"] },
            allowedDecision: "auto-approve",
            justification: { reason: "test", riskAssessment: "low", mitigationPlan: "fix" },
            timeBox: { issuedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-12-31T23:59:59Z" },
            createdBy: "user1",
            createdAt: "2026-01-01T00:00:00Z"
        }

        const exceptions = Array.from({ length: 11 }, (_, i) => ({ ...baseException, id: `EXP-${i}` }))

        // 2. Metrics for a new candidate run
        const heatmaps: HeatmapCell[] = [{
            scenarioId: "energy-happy",
            scenarioClass: "happy-path",
            phase: "INITIALIZED",
            changeType: "migration-only",
            severityScore: 1,
            occurrenceCount: 1,
            firstDivergenceTick: 0,
            examples: [{ description: "migration" }]
        }]

        const now = new Date("2026-05-01T00:00:00Z")
        const metrics = computeExceptionAnalytics(exceptions, heatmaps, now)

        // 3. Evaluate Escalations
        const escalation = evaluateEscalations(metrics, CanonicalEscalationRules, [], [], {}, [], {}, now)
        expect(escalation.level).toBe("freeze-release")

        expect(escalation.activeRules).toContain("EX-ACC-002")

        // 4. Evaluate Release Gate (should be blocked despite low severity change)
        const report = evaluateReleaseGate(heatmaps, DefaultReleaseGatePolicy, [], escalation, [], now)

        expect(report.decision).toBe("block-release")
        expect(report.rationale.some(r => r.includes("Release frozen"))).toBe(true)
    })


    it("escalates to governance approval when repeated scope hotspots are detected", () => {
        const exceptions: PolicyException[] = [
            {
                id: "EXP-1",
                title: "Repeated",
                description: "Repeated",
                scope: { scenarios: ["energy-blocking"] },
                allowedDecision: "auto-approve",
                justification: { reason: "test", riskAssessment: "low", mitigationPlan: "fix" },
                timeBox: { issuedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-12-31T23:59:59Z" },
                createdBy: "user1",
                createdAt: "2026-01-01T00:00:00Z"
            },
            { id: "EXP-2", title: "R2", description: "R2", scope: { scenarios: ["energy-blocking"] }, allowedDecision: "auto-approve", justification: { reason: "t", riskAssessment: "l", mitigationPlan: "f" }, timeBox: { issuedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-12-31T23:59:59Z" }, createdBy: "u", createdAt: "c" },
            { id: "EXP-3", title: "R3", description: "R3", scope: { scenarios: ["energy-blocking"] }, allowedDecision: "auto-approve", justification: { reason: "t", riskAssessment: "l", mitigationPlan: "f" }, timeBox: { issuedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-12-31T23:59:59Z" }, createdBy: "u", createdAt: "c" }
        ]

        const heatmaps: HeatmapCell[] = [{
            scenarioId: "energy-blocking",
            scenarioClass: "blocking-violation",
            phase: "RUNNING",
            changeType: "payload",
            severityScore: 6, // Above escalation threshold for happy-path but here it's below block (10)
            occurrenceCount: 1,
            firstDivergenceTick: 9,
            examples: [{ description: "payload" }]
        }]

        const now = new Date("2026-05-01T00:00:00Z")
        const metrics = computeExceptionAnalytics(exceptions, heatmaps, now)
        const escalation = evaluateEscalations(metrics, CanonicalEscalationRules, [], [], {}, [], {}, now)


        expect(escalation.level).toBe("require-governance-approval")
        expect(escalation.activeRules).toContain("EX-REP-001")

        const report = evaluateReleaseGate(heatmaps, DefaultReleaseGatePolicy, [], escalation, [], now)
        expect(report.decision).toBe("block-release") // Governance approval required = hard block unless overridden
        expect(report.rationale).toContain("Escalated to governance approval: auto-approve disabled")
    })


    it("pre-emptively freezes release when risk acceleration is detected", () => {
        // 1. Setup history with increasing risk
        const historyFast: any[] = [
            {
                timestamp: "2026-04-23T00:00:00Z",
                riskLoad: { totalRiskScore: 10 },
                global: { activeExceptions: 1 },
                aging: { under3Days: 1, days3to7: 0, days7to14: 0, expired: 0 },
                hotspots: []
            },
            {
                timestamp: "2026-04-24T00:00:00Z",
                riskLoad: { totalRiskScore: 31 }, // +21 points in 1 day = 21 pts/day
                global: { activeExceptions: 3 },
                aging: { under3Days: 3, days3to7: 0, days7to14: 0, expired: 0 },
                hotspots: []
            }
        ]

        const currentHeatmaps: HeatmapCell[] = [{
            scenarioId: "energy-happy",
            scenarioClass: "happy-path",
            phase: "RUNNING",
            changeType: "migration-only",
            severityScore: 1,
            occurrenceCount: 1,
            firstDivergenceTick: 0,
            examples: []
        }]

        const now = new Date("2026-04-24T00:00:01Z")
        const metrics = computeExceptionAnalytics([], currentHeatmaps, now)

        // Time to breach = (80 - 31) / 21 = 49 / 21 = 2.33 days. <= 7 (horizon).
        const escalation = evaluateEscalations(metrics, [], [
            {
                id: "PRED-001",
                signal: "time-to-breach",
                condition: i => {
                    const prev = i.history[i.history.length - 1]!
                    const riskDiff = i.current.riskLoad.totalRiskScore - prev.riskLoad.totalRiskScore
                    const timeDiff = new Date(i.current.timestamp).getTime() - new Date(prev.timestamp).getTime()
                    const days = timeDiff / (1000 * 60 * 60 * 24)
                    const rate = days > 0 ? riskDiff / days : 0
                    if (rate <= 0) return false
                    const t2b = (80 - i.current.riskLoad.totalRiskScore) / rate
                    return t2b <= i.horizonDays
                },
                level: "pre-freeze",
                actions: ["notify-governance-board"]
            }
        ], historyFast, {}, [], {}, now)



        expect(escalation.level).toBe("pre-freeze")
        expect(escalation.activeRules).toContain("PRED-001")

        const report = evaluateReleaseGate(currentHeatmaps, DefaultReleaseGatePolicy, [], escalation, [], now)
        expect(report.decision).toBe("block-release")
        expect(report.rationale.some(r => r.includes("pre-frozen"))).toBe(true)
    })


    it("triggers escalation based on deterministic confidence bands", () => {
        // Current risk 45. Deltas: [+1, +3, +2, +5, +4]. Horizon 7. Threshold 50.
        const now = new Date("2026-05-10T00:00:00Z")

        // Constructing history to match deltas
        const history: any[] = [
            { timestamp: "2026-05-05T00:00:00Z", riskLoad: { totalRiskScore: 30 }, global: { activeExceptions: 0 }, aging: { days7to14: 0 }, hotspots: [] },
            { timestamp: "2026-05-06T00:00:00Z", riskLoad: { totalRiskScore: 31 }, global: { activeExceptions: 0 }, aging: { days7to14: 0 }, hotspots: [] }, // +1
            { timestamp: "2026-05-07T00:00:00Z", riskLoad: { totalRiskScore: 34 }, global: { activeExceptions: 0 }, aging: { days7to14: 0 }, hotspots: [] }, // +3
            { timestamp: "2026-05-08T00:00:00Z", riskLoad: { totalRiskScore: 36 }, global: { activeExceptions: 0 }, aging: { days7to14: 0 }, hotspots: [] }, // +2
            { timestamp: "2026-05-09T00:00:00Z", riskLoad: { totalRiskScore: 41 }, global: { activeExceptions: 0 }, aging: { days7to14: 0 }, hotspots: [] }  // +5
        ]
        const current: any = { timestamp: "2026-05-10T00:00:00Z", riskLoad: { totalRiskScore: 45 }, global: { activeExceptions: 0 }, aging: { days7to14: 0 }, hotspots: [] } // +4

        // Actual deltas: [1, 3, 2, 5, 4]
        // Current=45. Min=1, Max=5, Avg=3.
        // Horizon=7.
        // Best: 45 + 1*7 = 52. Expected: 45 + 3*7 = 66. Worst: 45 + 5*7 = 80.
        // Threshold 50 matches all.

        const band = calculateConfidenceBand("riskScore", 50, { history, current, horizonDays: 7 })

        expect(band.breachAssessment.bestCaseBreaches).toBe(true)
        expect(band.breachAssessment.expectedCaseBreaches).toBe(true)
        expect(band.breachAssessment.worstCaseBreaches).toBe(true)

        // Escalation Interpretation:
        // expectedCase breach -> pre-freeze

        const predictiveRule: any = {
            id: "PRED-CONF-001",
            signal: "time-to-breach",
            condition: (i: any) => {
                const b = calculateConfidenceBand("riskScore", 50, i)
                return b.breachAssessment.expectedCaseBreaches
            },
            level: "pre-freeze",
            actions: ["tighten-release-gate"]
        }

        const metrics = computeExceptionAnalytics([], [], now)
        const escalation = evaluateEscalations(metrics, [], [predictiveRule], history, {}, [], {}, now)

        expect(escalation.level).toBe("pre-freeze")
        expect(escalation.activeRules).toContain("PRED-CONF-001")
    })

    it("triggers targeted escalation based on scenario-specific confidence bands", () => {
        const scenarioId = "energy-blocking"
        const now = new Date("2026-05-10T00:00:00Z")

        // Scenario: energy-blocking (blocking-violation). Threshold risk: 10.
        // History: risk 1, 2, 4 (deltas 1, 2)
        const sHistory: any[] = [
            { timestamp: "2026-05-08T00:00:00Z", riskScore: 1, activeExceptions: 0, aging7to14: 0 },
            { timestamp: "2026-05-09T00:00:00Z", riskScore: 2, activeExceptions: 0, aging7to14: 0 }
        ]
        const sCurrent: any = { timestamp: "2026-05-10T00:00:00Z", riskScore: 4, activeExceptions: 0, aging7to14: 0 }

        // Rates: 1, 2. Current: 4. threshold: 10. horizon: 7.
        // Best: 4 + 1*7 = 11 (Breach). Expected: 4 + 1.5*7 = 14.5 (Breach). Worst: 4 + 2*7 = 18 (Breach).
        // Since bestCaseBreaches -> pre-freeze.

        const metrics: any = {
            global: { activeExceptions: 0, expiredExceptions: 0, riskyExceptions: 0, pendingReview: 0 },
            riskLoad: { totalRiskScore: 4, scenarioCount: 1, averageRiskPerScenario: 4 },
            aging: { under3Days: 0, days3to7: 0, days7to14: 0, expired: 0 },
            hotspots: [{ id: scenarioId, exceptionCount: 1, cumulativeRisk: 4, repeated: false }],
            accountability: { creators: [], scenarios: [] }
        }

        const escalation = evaluateEscalations(metrics, [], [], [], { [scenarioId]: sHistory }, [], {}, now)

        expect(escalation.level).toBe("pre-freeze")
        expect(escalation.activeRules).toContain(`SCENARIO-BAND-${scenarioId}`)
        expect(escalation.actions).toContain("notify-risk-owner")
        expect(escalation.openSLAs.length).toBe(1)
        expect(escalation.openSLAs[0]!.severity).toBe("blocking")
    })

    it("closes SLA only when MIS proves impact (Evidence-Based Clearance)", () => {
        const scenarioId = "energy-blocking"
        const now = new Date("2026-05-10T00:00:00Z")
        const sHistory: any[] = [
            { timestamp: "2026-05-08T00:00:00Z", riskScore: 1, activeExceptions: 0, aging7to14: 0 },
            { timestamp: "2026-05-09T00:00:00Z", riskScore: 2, activeExceptions: 0, aging7to14: 0 }
        ]
        const sCurrent: any = { timestamp: "2026-05-10T00:00:00Z", riskScore: 4, activeExceptions: 0, aging7to14: 0 }

        const metrics: any = {
            global: { activeExceptions: 0, expiredExceptions: 0, riskyExceptions: 0, pendingReview: 0 },
            riskLoad: { totalRiskScore: 4, scenarioCount: 1, averageRiskPerScenario: 4 },
            aging: { under3Days: 0, days3to7: 0, days7to14: 0, expired: 0 },
            hotspots: [{ id: scenarioId, exceptionCount: 1, cumulativeRisk: 4, repeated: false }],
            accountability: { creators: [], scenarios: [] }
        }

        // 1. Trigger SLA
        const e1 = evaluateEscalations(metrics, [], [], [], { [scenarioId]: sHistory }, [], {}, now)
        expect(e1.openSLAs[0]!.status).toBe("open")

        // 2. Simulate insufficient mitigation
        const misInsufficient = simulateMitigationImpact({
            scenarioId,
            scenarioClass: "blocking-violation",
            history: sHistory,
            current: sCurrent,
            effects: [{ metric: "riskScore", effect: { type: "rate-reduction", value: 0.1 } }],
            horizonDays: 7
        }, "MIT-1")
        expect(misInsufficient.verdict).toBe("insufficient")

        const e2 = evaluateEscalations(metrics, [], [], [], { [scenarioId]: sHistory }, e1.openSLAs, { [scenarioId]: misInsufficient.verdict }, now)
        expect(e2.openSLAs[0]!.status).toBe("open") // Not resolved

        // 3. Simulate sufficient mitigation (rate inversion)
        const misSufficient = simulateMitigationImpact({
            scenarioId,
            scenarioClass: "blocking-violation",
            history: sHistory,
            current: sCurrent,
            effects: [{ metric: "riskScore", effect: { type: "rate-inversion", value: 1 } }], // Forces rate to -1
            horizonDays: 7
        }, "MIT-2")
        expect(misSufficient.verdict).toBe("sufficient")

        const e3 = evaluateEscalations(metrics, [], [], [], { [scenarioId]: sHistory }, e1.openSLAs, { [scenarioId]: misSufficient.verdict }, now)
        expect(e3.openSLAs[0]!.status).toBe("resolved")
        expect(e3.level).toBe("notify") // Escalation cleared
    })


    it("ranks mitigation suggestions by provable worst-case impact (AMSR)", () => {
        const scenarioId = "energy-blocking"
        const now = new Date("2026-05-10T00:00:00Z")
        const sHistory: any[] = [
            { timestamp: "2026-05-08T00:00:00Z", riskScore: 1, activeExceptions: 0, aging7to14: 0 },
            { timestamp: "2026-05-09T00:00:00Z", riskScore: 2, activeExceptions: 0, aging7to14: 0 }
        ]
        const sCurrent: any = { timestamp: "2026-05-10T00:00:00Z", riskScore: 4, activeExceptions: 0, aging7to14: 0 }

        const suggestions = rankMitigationSuggestions({
            scenarioId,
            scenarioClass: "blocking-violation",
            history: sHistory,
            current: sCurrent,
            horizonDays: 7,
            thresholds: { riskScore: 10, activeExceptions: 1, aging7to14: 0 }
        })

        expect(suggestions.length).toBeGreaterThan(0)
        expect(suggestions[0]!.rank).toBe(1)
        expect(suggestions[0]!.misSummary.verdict).toBe("sufficient")
        expect(suggestions[0]!.scores.impactScore).toBeGreaterThan(0)
    })
})


