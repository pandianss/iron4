import { FailureScenario } from "../types"
import { EnergyHappyScenario } from "./energy-happy"
import { EnergyBlockingScenario } from "./energy-blocking"
import { MigrateV1toV2 } from "../../../src/core/migration"
import { replaySimulation } from "../../support/replay-helper"
import { Rule, RuleId } from "../../../src/governance/rule"
import { WarnOnLowEnergyPolicy } from "../../../src/governance/policies/energy-policies"
import { Policy, PolicyId } from "../../../src/governance/policy"


export const CriticalAlwaysFailRule: Rule = {
    id: "R-FAIL-ALWAYS" as RuleId,
    name: "Injected Critical Failure",
    kind: "invariant",
    description: "Fails deterministically for testing",
    appliesTo: () => true,
    evaluate: () => ({
        status: "violation",
        severity: "critical",
        code: "INJECTED_FAIL",
        message: "Injected critical governance failure"
    })
}

export const AlwaysBlockFailurePolicy: Policy = {
    id: "P-BLOCK-INJECTED-FAIL" as PolicyId,
    appliesTo: (_rule, result) => result.status === "violation" && result.code === "INJECTED_FAIL",
    effect: () => ({ action: "block" })
}



export const GovernanceFailureAfterMigration: FailureScenario = {
    id: "fail-governance-after-migration",
    class: "governance-critical",
    description: "Critical rule blocks simulation in v2 after migration",

    run() {
        return replaySimulation({
            scenario: EnergyHappyScenario,
            migrate: MigrateV1toV2,
            overrideRules: [CriticalAlwaysFailRule],
            overridePolicies: [AlwaysBlockFailurePolicy]

        })
    }
}

export const MigrationFailureScenario: FailureScenario = {
    id: "fail-migration-v1-to-v2",
    class: "migration-failure",
    description: "Migration throws and simulation terminates safely",

    run() {
        return replaySimulation({
            scenario: EnergyHappyScenario,
            migrate: {
                from: "v1",
                to: "v2",
                migrate: () => { throw new Error("Injected migration failure") }
            }
        })
    }
}

export const PolicyMisconfigurationScenario: FailureScenario = {
    id: "fail-policy-misconfig",
    class: "policy-misconfiguration",
    description: "Critical violation with warn-only policy",

    run() {
        return replaySimulation({
            scenario: EnergyBlockingScenario,
            migrate: MigrateV1toV2,
            overridePolicies: [
                WarnOnLowEnergyPolicy
            ]
        })
    }
}
