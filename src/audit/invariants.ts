import { ChaosConfidenceScore, ChaosExperimentResult } from "./chaos";
import { ScenarioSLA } from "./escalations";
import { ReleaseGateDecisionReport } from "./gating";

/**
 * Formal Invariants for Resilience Governance
 * These must hold true at all times to ensure economic and safety integrity.
 */

export type InvariantVerdict = {
    valid: boolean;
    violations: string[];
};

/**
 * Invariant 1: Confidence Integrity
 * Confidence in a scenario cannot increase unless a chaos experiment for that
 * scenario was successfully completed within the same or prior window.
 */
export function verifyConfidenceIntegrity(
    previous: ChaosConfidenceScore,
    current: ChaosConfidenceScore,
    experiments: ChaosExperimentResult[]
): InvariantVerdict {
    const violations: string[] = [];
    if (current.score > previous.score) {
        const relevantExperiment = experiments.find(e => e.observedCascade.scenarios.includes(current.scenarioId));
        if (!relevantExperiment) {
            violations.push(`Confidence for ${current.scenarioId} increased from ${previous.score} to ${current.score} without a recorded chaos experiment.`);
        }
    }
    return { valid: violations.length === 0, violations };
}

/**
 * Invariant 2: SLA Safety
 * No release can be "auto-approved" if there is an open "blocking" or "critical" SLA
 * for any scenario in the scope.
 */
export function verifySLASafety(
    decision: ReleaseGateDecisionReport,
    openSLAs: ScenarioSLA[]
): InvariantVerdict {
    const violations: string[] = [];
    if (decision.decision === "auto-approve") {
        const badSLAs = openSLAs.filter(sla => (sla.severity === "blocking" || sla.severity === "critical") && sla.status === "open");
        if (badSLAs.length > 0) {
            violations.push(`Release auto-approved despite open high-severity SLAs: ${badSLAs.map(s => s.scenarioId).join(", ")}`);
        }
    }
    return { valid: violations.length === 0, violations };
}

/**
 * Invariant 3: Economic Bound
 * Chaos consumption cannot exceed the total allocated budget units.
 */
export function verifyEconomicBound(
    consumed: number,
    allocated: number
): InvariantVerdict {
    const violations: string[] = [];
    if (consumed > allocated) {
        violations.push(`Chaos units consumed (${consumed}) exceeds allocated budget (${allocated}).`);
    }
    return { valid: violations.length === 0, violations };
}
