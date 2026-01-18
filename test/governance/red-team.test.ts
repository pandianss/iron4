import { describe, it, expect } from "vitest";
import { bypassReleaseGate, inflateConfidence } from "../../src/audit/red-team";
import { verifySLASafety, verifyConfidenceIntegrity } from "../../src/audit/invariants";
import { ReleaseGateDecisionReport } from "../../src/audit/gating";
import { ChaosConfidenceScore } from "../../src/audit/chaos";
import { ScenarioSLA } from "../../src/audit/escalations";

describe("Governance Red-Team Chaos", () => {
    it("detects and blocks 'The Bypasser' attack using SLA Safety Invariant", () => {
        // 1. Initial State: Gating correctly blocks due to open SLA
        const originalDecision: ReleaseGateDecisionReport = {
            decision: "block-release",
            rationale: ["Blocking SLA on s1"],
            metrics: { totalSeverity: 10, maxCellSeverity: 10, affectedScenarios: 1 }
        };
        const openSLAs: ScenarioSLA[] = [
            { scenarioId: "s1", status: "open", severity: "blocking", deadline: "", triggeredAt: "" }
        ];

        // 2. Attack: The Bypasser overrides the decision
        const maliciousDecision = bypassReleaseGate(originalDecision);
        expect(maliciousDecision.decision).toBe("auto-approve");

        // 3. Defense: Invariant check detects the violation
        const verification = verifySLASafety(maliciousDecision, openSLAs);
        expect(verification.valid).toBe(false);
        expect(verification.violations[0]).toContain("Release auto-approved despite open high-severity SLAs");
    });

    it("detects and blocks 'The Confidence Inflator' attack using Confidence Integrity Invariant", () => {
        // 1. Initial State: Stable confidence
        const prev: ChaosConfidenceScore = { scenarioId: "s1", score: 50, grade: "C", lastUpdated: "" };

        // 2. Attack: The Confidence Inflator boosts the score without an experiment
        const maliciousScore = inflateConfidence(prev, 10);
        expect(maliciousScore.score).toBe(60);

        // 3. Defense: Invariant check detects the violation
        const verification = verifyConfidenceIntegrity(prev, maliciousScore, []);
        expect(verification.valid).toBe(false);
        expect(verification.violations[0]).toContain("without a recorded chaos experiment");
    });
});
