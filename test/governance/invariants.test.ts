import { describe, it, expect } from "vitest";
import { verifyConfidenceIntegrity, verifySLASafety, verifyEconomicBound } from "../../src/audit/invariants";
import { ChaosConfidenceScore, ChaosExperimentResult } from "../../src/audit/chaos";
import { ScenarioSLA } from "../../src/audit/escalations";
import { ReleaseGateDecisionReport } from "../../src/audit/gating";

describe("Formal Invariants Enforcement", () => {
    it("enforces Confidence Integrity (No gain without experiment)", () => {
        const prev: ChaosConfidenceScore = { scenarioId: "s1", score: 50, grade: "C", lastUpdated: "" };
        const curr: ChaosConfidenceScore = { scenarioId: "s1", score: 60, grade: "C", lastUpdated: "" };

        // No experiments
        const v1 = verifyConfidenceIntegrity(prev, curr, []);
        expect(v1.valid).toBe(false);
        expect(v1.violations[0]).toContain("without a recorded chaos experiment");

        // With relevant experiment
        const exp: ChaosExperimentResult = {
            experimentId: "e1",
            observedCascade: { scenarios: ["s1"], depth: 1 },
            verdict: "validated",
            findings: []
        };
        const v2 = verifyConfidenceIntegrity(prev, curr, [exp]);
        expect(v2.valid).toBe(true);
    });

    it("enforces SLA Safety (No auto-approve with open SLAs)", () => {
        const decision: ReleaseGateDecisionReport = {
            decision: "auto-approve",
            rationale: [],
            metrics: { totalSeverity: 0, maxCellSeverity: 0, affectedScenarios: 0 }
        };
        const openSLAs: ScenarioSLA[] = [
            { scenarioId: "s1", status: "open", severity: "blocking", deadline: "", triggeredAt: "" }
        ];

        const v1 = verifySLASafety(decision, openSLAs);
        expect(v1.valid).toBe(false);
        expect(v1.violations[0]).toContain("despite open high-severity SLAs");

        const v2 = verifySLASafety({ ...decision, decision: "block-release" }, openSLAs);
        expect(v2.valid).toBe(true);
    });

    it("enforces Economic Bound (Consumption <= Allocation)", () => {
        const v1 = verifyEconomicBound(11, 10);
        expect(v1.valid).toBe(false);
        expect(v1.violations[0]).toContain("exceeds allocated budget");

        const v2 = verifyEconomicBound(10, 10);
        expect(v2.valid).toBe(true);
    });
});
