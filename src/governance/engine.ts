import type { Rule, RuleResult, RuleInput } from "./rule"
import type { Policy } from "./policy"
import type { PolicyId } from "../shared/ids"

export type GovernanceDecision = "accept" | "reject"

export type GovernanceEvaluation = {
    readonly results: readonly RuleResult[]
    readonly decision: GovernanceDecision
    readonly appliedPolicies: readonly PolicyId[]
}

export interface GovernanceEngine {
    evaluate(input: RuleInput): GovernanceEvaluation
}

// Simple Implementation (No Policies)
export class SimpleGovernanceEngine implements GovernanceEngine {
    constructor(
        private readonly rules: readonly Rule[]
    ) { }

    evaluate(input: RuleInput): GovernanceEvaluation {
        const results = this.rules
            .filter(r => r.appliesTo(input))
            .map(r => r.evaluate(input as never))

        const rejected = results.some(
            r => r.status === "violation" && r.severity === "critical"
        )

        return {
            results,
            decision: rejected ? "reject" : "accept",
            appliedPolicies: []
        }
    }
}

// Policy-Aware Implementation
export class PolicyAwareGovernanceEngine implements GovernanceEngine {
    constructor(
        private readonly rules: readonly Rule[],
        private readonly policies: readonly Policy[]
    ) { }

    evaluate(input: RuleInput): GovernanceEvaluation {
        const results: RuleResult[] = []
        const appliedPolicies: PolicyId[] = []

        let decision: GovernanceDecision = "accept"

        for (const rule of this.rules) {
            if (!rule.appliesTo(input)) continue

            const result = rule.evaluate(input as never)
            results.push(result)

            if (result.status === "violation") {
                for (const policy of this.policies) {
                    if (policy.appliesTo(rule, result)) {
                        const effect = policy.effect(result)
                        appliedPolicies.push(policy.id)

                        if (effect.action === "block") {
                            decision = "reject"
                        }
                    }
                }
            }
        }

        return { results, decision, appliedPolicies }
    }
}
