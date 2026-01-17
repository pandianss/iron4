import type { Policy } from "../policy"
import type { PolicyId, RuleId } from "../../shared/ids"

export const BlockOnNegativeEnergyPolicy: Policy = {
    id: "P-BLOCK-NEG-ENERGY" as PolicyId,

    appliesTo(rule, result) {
        return (
            rule.id === ("R-INV-ENERGY" as RuleId) &&
            result.status === "violation" &&
            result.severity === "critical"
        )
    },

    effect() {
        return { action: "block" }
    }
}

export const WarnOnLowEnergyPolicy: Policy = {
    id: "P-WARN-LOW-ENERGY" as PolicyId,

    appliesTo(rule, result) {
        return (
            rule.id === ("R-INV-ENERGY" as RuleId) &&
            result.status === "violation" &&
            result.severity === "warning"
        )
    },

    effect() {
        return { action: "warn" }
    }
}
