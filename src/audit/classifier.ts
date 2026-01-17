import { AuditRecord, AuditAction } from "./audit-record"
import { AuditSemanticDiff } from "./diff"
import { StateVersion } from "../core/state"

export type ChangeClass =
    | "non-breaking"
    | "breaking"
    | "breaking-with-migration"
    | "behavior-preserving"
    | "inconclusive"

export type ForbiddenChange =
    | "termination-reason"
    | "transition-acceptance"
    | "policy-escalation"
    | "governance-decision"

export type ChangeRuleset = {
    allowedActionAdditions: AuditAction[]
    allowedMessageChanges: boolean
    allowedMetadataChanges: boolean
    allowedMigrationActions: boolean
    requireMigrationFor: readonly StateVersion[]
}

export type ChangeClassificationInput = {
    baseline: {
        audit: readonly AuditRecord[]
        version: StateVersion
    }
    candidate: {
        audit: readonly AuditRecord[]
        version: StateVersion
    }
    semanticDiff: AuditSemanticDiff | null
    ruleset: ChangeRuleset
}

export const DefaultChangeRuleset: ChangeRuleset = {
    allowedActionAdditions: ["migrate.state"],
    allowedMessageChanges: true,
    allowedMetadataChanges: true,
    allowedMigrationActions: true,
    requireMigrationFor: ["v2"]
}

export function classifyChange(input: ChangeClassificationInput): ChangeClass {
    const { baseline, candidate, semanticDiff, ruleset } = input

    if (!semanticDiff) {
        return "behavior-preserving"
    }

    // Step 2: Migration-Only Difference
    if (semanticDiff.divergenceType === "migration") {
        return ruleset.allowedMigrationActions
            ? "behavior-preserving"
            : "breaking-with-migration"
    }

    // Step 3-5: Critical Behavioral Changes
    if (
        semanticDiff.divergenceType === "policy-escalation" ||
        semanticDiff.divergenceType === "governance-decision" ||
        semanticDiff.divergenceType === "termination" ||
        semanticDiff.divergenceType === "action-sequence"
    ) {
        return "breaking"
    }

    // Step 6: Payload-Only Changes (Messages/Metadata)
    if (semanticDiff.divergenceType === "payload") {
        return ruleset.allowedMessageChanges
            ? "non-breaking"
            : "breaking"
    }

    // Step 7: Version Boundary Check
    if (baseline.version !== candidate.version) {
        return "breaking-with-migration"
    }

    return "inconclusive"
}
