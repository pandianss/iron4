import type { PolicyId } from "../shared/ids"
import type { Rule, RuleResult } from "./rule"

export type PolicyEffect =
    | { action: "allow" }
    | { action: "warn" }
    | { action: "block" }

export type Policy = {
    readonly id: PolicyId
    appliesTo(rule: Rule, result: RuleResult): boolean
    effect(result: RuleResult): PolicyEffect
}
