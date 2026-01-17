import type { Rule, RuleInput } from "../rule"
import type { RuleId } from "../../shared/ids"
import type { State } from "../../core/state"

export const NoNegativeEnergyRule: Rule<{ type: "state"; state: State }> = {
    id: "R-INV-ENERGY" as RuleId,
    name: "No Negative Energy",
    kind: "invariant",
    description: "Energy must never be negative.",

    appliesTo: (input): input is { type: "state"; state: State } => {
        return input.type === "state"
    },

    evaluate: (input) => {
        const { state } = input
        const energy = state.data.entities["energy"] as { kind: "resource"; amount: number } | undefined
        if (!energy) return { status: "pass" }

        return energy.amount < 0
            ? {
                status: "violation",
                severity: "critical" as const,
                code: "NEG_ENERGY",
                message: "Energy dropped below zero."
            }
            : { status: "pass" }
    }
}
