import { AuditRecord } from "./audit-record"

export type AuditSemanticDiff = {
    summary: string
    firstDivergenceTick: number
    divergenceType:
    | "action-sequence"
    | "governance-decision"
    | "policy-escalation"
    | "termination"
    | "migration"
    | "payload"
    explanation: string
    details?: unknown
}

export function explainAuditDiff(expected: readonly AuditRecord[], actual: readonly AuditRecord[]): AuditSemanticDiff | null {
    const minLength = Math.min(expected.length, actual.length)

    for (let i = 0; i < minLength; i++) {
        const exp = expected[i]!
        const act = actual[i]!

        if (exp.integrity.hash !== act.integrity.hash) {
            const tick = act.timestamp.tick

            // Level 1: Action Sequence
            if (exp.action !== act.action) {
                return {
                    divergenceType: "action-sequence",
                    summary: "Audit action sequence changed",
                    firstDivergenceTick: tick,
                    explanation: `Expected '${exp.action}' but got '${act.action}'`
                }
            }

            // Level 2: Decision
            if (exp.action === "governance.evaluate" && act.action === "governance.evaluate") {
                if (exp.result.status !== act.result.status) {
                    return {
                        divergenceType: "governance-decision",
                        summary: "Governance decision changed",
                        firstDivergenceTick: tick,
                        explanation: `Decision changed from ${exp.result.status} to ${act.result.status}`
                    }
                }
            }

            if (exp.action === "policy.apply" && act.action === "policy.apply") {
                if (exp.subject.id !== act.subject.id) {
                    return {
                        divergenceType: "policy-escalation",
                        summary: "Different policy applied",
                        firstDivergenceTick: tick,
                        explanation: `Expected policy ${exp.subject.id}, got ${act.subject.id}`
                    }
                }
            }

            if (exp.action === "terminate" && act.action === "terminate") {
                return {
                    divergenceType: "termination",
                    summary: "Termination behavior changed",
                    firstDivergenceTick: tick,
                    explanation: `Termination reason changed from '${exp.result.status}' to '${act.result.status}'`
                }
            }

            if (exp.action === "migrate.state" || act.action === "migrate.state") {
                return {
                    divergenceType: "migration",
                    summary: "Migration behavior changed",
                    firstDivergenceTick: tick,
                    explanation: "State migration produced different audit outcome"
                }
            }

            // Level 3: Payload
            return {
                divergenceType: "payload",
                summary: "Audit payload changed",
                firstDivergenceTick: tick,
                explanation: "Audit payload content differs despite identical actions",
                details: {
                    expected: exp.payload,
                    actual: act.payload
                }
            }
        }
    }

    if (expected.length !== actual.length) {
        return {
            divergenceType: "action-sequence",
            summary: "Audit chain length changed",
            firstDivergenceTick: minLength,
            explanation: `Expected ${expected.length} records, got ${actual.length}`
        }
    }

    return null
}
