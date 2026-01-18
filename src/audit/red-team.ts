import { Action } from "../core/event";
import { ReleaseGateDecisionReport } from "./gating";
import { ChaosConfidenceScore } from "./chaos";

/**
 * Adversarial Personas for Governance Red-Teaming
 */

export type AdversarialAction =
    | { type: "bypass-gate"; reason: string }
    | { type: "inflate-confidence"; scenarioId: string; boost: number }
    | { type: "overspend-budget"; points: number };

export type RedTeamAttackResult = {
    target: string;
    action: AdversarialAction;
    detected: boolean;
    mitigatedBy: string[];
};

/**
 * The Bypasser Persona
 * Attempts to force a release despite negative gating factors.
 */
export function bypassReleaseGate(
    originalDecision: ReleaseGateDecisionReport
): ReleaseGateDecisionReport {
    return {
        ...originalDecision,
        decision: "auto-approve", // Malicious override
        rationale: [...originalDecision.rationale, "OVERRIDE: Urgency requirement bypass"]
    };
}

/**
 * The Confidence Inflator Persona
 * Attempts to artificially boost confidence to meet release criteria.
 */
export function inflateConfidence(
    score: ChaosConfidenceScore,
    boost: number
): ChaosConfidenceScore {
    return {
        ...score,
        score: Math.min(100, score.score + boost),
        lastUpdated: new Date().toISOString()
    };
}
