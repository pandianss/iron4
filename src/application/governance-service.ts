import { Rule } from "../governance/rule"
import { Policy } from "../governance/policy"

export interface GovernanceService {
    registerRule(rule: Rule): void
    registerPolicy(policy: Policy): void
}
