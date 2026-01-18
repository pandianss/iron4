import { ScenarioId } from "./coupling";
import { ChaosConfidenceScore } from "./chaos";

// --- Layer 2: Evidence & Attestation Protocols ---

export type EvidenceHash = string;

export type Attestation = {
    attestationId: string;
    subjectId: string; // Individual ID, Asset ID, or Scenario ID
    claim: string;
    evidenceLinks: readonly EvidenceHash[];
    issuedAt: string;
    expiresAt: string;
    issuer: "kernel" | "governor";
};

// --- Layer 3: Identity & Trust Protocols ---

export type IndividualTrustProfile = {
    personId: string;
    confidenceImpactScore: number;
    violationRate: number;
    forecastAccuracy: number;
    currentTrustScore: number; // calculated from metrics
};

export type EnterpriseEntity = {
    entityId: string;
    type: "employee" | "asset" | "service-account";
    confidenceScore?: number; // For assets
    reliabilityScore?: number; // For employees/accounts
    status: "active" | "quarantined" | "suspended";
};

// --- Layer 4: Authority & Delegation Protocols ---

export type Condition = {
    type: "confidence-threshold" | "violation-history" | "paired-approval" | "budget-available";
    value: any;
};

export type AuthorityToken = {
    tokenId: string;
    actorId: string;
    action: string;
    scope: string; // scenario, department, or global
    conditions: readonly Condition[];
    issuedAt: string;
    expiresAt: string;
};

// --- Layer 5: Incentive & Obligation Protocols ---

export type Obligation = {
    obligationId: string;
    actorId: string;
    requiredOutcome: string;
    deadline: string;
    evidenceRequired: string[];
    met: boolean;
};

export type Incentive = {
    actorId: string;
    rewardType: "authority" | "compensation" | "autonomy";
    predicate: string; // e.g., "confidence_gain > 10"
};

// --- Layer 6: Accountability & Consequence Protocols ---

export type ConsequenceType =
    | "authority-suspension"
    | "mandatory-review"
    | "asset-quarantine"
    | "role-downgrade";

export type AccountabilityEvent = {
    eventId: string;
    actorId: string;
    triggerAction: string;
    outcome: "success" | "violation";
    consequence?: {
        type: ConsequenceType;
        durationDays?: number;
    };
    timestamp: string;
};

// --- Governance Engines ---

/**
 * Layer 4: Authority Engine
 * Validates authority tokens against real-time system state (Evidence).
 */
export function validateAuthority(
    token: AuthorityToken,
    context: {
        confidenceScore?: number;
        recentViolations: number;
        budgetAvailable: number;
    }
): { authorized: boolean; reason?: string } {
    for (const condition of token.conditions) {
        if (condition.type === "confidence-threshold") {
            if (context.confidenceScore === undefined || context.confidenceScore < condition.value) {
                return { authorized: false, reason: `Confidence ${context.confidenceScore} < required ${condition.value}` };
            }
        }
        if (condition.type === "violation-history") {
            if (context.recentViolations > condition.value) {
                return { authorized: false, reason: `Recent violations ${context.recentViolations} > allowed ${condition.value}` };
            }
        }
        if (condition.type === "budget-available") {
            if (context.budgetAvailable < condition.value) {
                return { authorized: false, reason: `Chaos budget ${context.budgetAvailable} < required ${condition.value}` };
            }
        }
    }

    if (new Date(token.expiresAt) < new Date()) {
        return { authorized: false, reason: "Authority token expired" };
    }

    return { authorized: true };
}

/**
 * Layer 6: Consequence Engine
 * Automatically applies consequences based on accountability outcomes.
 */
export function processAccountability(
    actorId: string,
    outcome: "success" | "violation",
    trigger: string
): AccountabilityEvent {
    let consequence: AccountabilityEvent["consequence"] = undefined;

    if (outcome === "violation") {
        // Mechanical consequence: any violation leads to mandatory review
        consequence = { type: "mandatory-review" };

        // Critical failures lead to authority suspension
        if (trigger.includes("safety-breach") || trigger.includes("SLA-breach")) {
            consequence = { type: "authority-suspension", durationDays: 7 };
        }
    }

    return {
        eventId: `EVT-${actorId}-${Date.now()}`,
        actorId,
        triggerAction: trigger,
        outcome,
        consequence,
        timestamp: new Date().toISOString()
    };
}

/**
 * Layer 3: Identity Engine
 * Calculates trust profiles based on performance evidence.
 */
export function updateTrustProfile(
    profile: IndividualTrustProfile,
    impact: number,
    accuracy: number,
    violations: number
): IndividualTrustProfile {
    const newImpact = profile.confidenceImpactScore + impact;
    const newAccuracy = (profile.forecastAccuracy * 0.7) + (accuracy * 0.3);
    const newViolationRate = (profile.violationRate * 0.8) + (violations > 0 ? 0.2 : 0);

    // Trust Score Evolution:
    // Base 20 + Impact (5/pt, max 40) + Accuracy (40 pts) + Violation Penalty (20 pts)
    const impactContribution = Math.min(40, newImpact * 4);
    const accuracyContribution = newAccuracy * 40;
    const stabilityContribution = (1 - newViolationRate) * 20;

    const trustScore = Math.min(100, impactContribution + accuracyContribution + stabilityContribution);

    return {

        personId: profile.personId,
        confidenceImpactScore: newImpact,
        forecastAccuracy: newAccuracy,
        violationRate: newViolationRate,
        currentTrustScore: trustScore
    };
}

/**
 * Layer 5: Incentive Engine
 * Maps system truth to authority and autonomy rewards.
 */
export function evaluateIncentives(
    profile: IndividualTrustProfile
): Incentive[] {
    const incentives: Incentive[] = [];

    if (profile.currentTrustScore >= 80) {
        incentives.push({
            actorId: profile.personId,
            rewardType: "authority",
            predicate: "Trust score reached elite threshold (80)"
        });
    }

    if (profile.forecastAccuracy >= 0.9) {
        incentives.push({
            actorId: profile.personId,
            rewardType: "autonomy",
            predicate: "High forecast accuracy (>= 90%) earned additional self-governance"
        });
    }

    return incentives;
}

/**
 * The Constitutional Governance Kernel
 * Orchestrates all layers to enforce the Individual and Enterprise Constitutions.
 */
export class GovernanceKernel {
    private entities: Map<string, EnterpriseEntity> = new Map();
    private profiles: Map<string, IndividualTrustProfile> = new Map();

    public registerEntity(entity: EnterpriseEntity) {
        this.entities.set(entity.entityId, entity);
    }

    public registerProfile(profile: IndividualTrustProfile) {
        this.profiles.set(profile.personId, profile);
    }

    public executeAction(
        actorId: string,
        token: AuthorityToken,
        context: { confidenceScore?: number; recentViolations: number; budgetAvailable: number }
    ): { success: boolean; event: AccountabilityEvent } {
        const auth = validateAuthority(token, context);

        let outcome: "success" | "violation" = auth.authorized ? "success" : "violation";
        const event = processAccountability(actorId, outcome, token.action);

        // Apply state changes to entities if needed (e.g. quarantine)
        const entity = this.entities.get(actorId);
        if (entity && event.consequence?.type === "authority-suspension") {
            entity.status = "suspended";
        }

        return { success: auth.authorized, event };
    }
}


