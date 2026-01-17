import type { RuleId } from "../shared/ids"
import type { State } from "../core/state"
import type { Event } from "../core/event"

export type RuleKind =
    | "invariant"
    | "conditional"
    | "temporal"
    | "structural"

export type RuleInput =
    | { type: "state"; state: State }
    | { type: "transition"; from: State; to: State; event: Event }
    | { type: "timeline"; states: readonly State[] }

export type Severity = "info" | "warning" | "error" | "critical"

export type RuleResult =
    | { status: "pass" }
    | {
        status: "violation"
        severity: Severity
        code: string
        message: string
        evidence?: unknown
    }

export type Rule<I extends RuleInput = RuleInput> = {
    readonly id: RuleId
    readonly name: string
    readonly kind: RuleKind
    readonly description: string
    appliesTo(input: I): boolean
    evaluate(input: I): RuleResult
}
