import type { SimulationId } from "../shared/ids"
import type { State } from "../core/state"
import type { Event } from "../core/event"
import type { Transition } from "../core/transition"
import type { GovernanceEngine } from "../governance/engine"

export type SimulationPhase =
    | "DEFINED"
    | "INITIALIZED"
    | "READY"
    | "RUNNING"
    | "PAUSED"
    | "TERMINATING"
    | "TERMINATED"

export type TerminationCondition =
    | { type: "maxTicks"; limit: number }
    | { type: "goal"; predicate: (state: State) => boolean }
    | { type: "stable"; window: number }
    | { type: "violation"; severity: "critical" }
    | { type: "external"; signalId: string }

import type { StateMigration } from "../core/migration"

export type SimulationDefinition = {
    readonly id: SimulationId
    readonly version: string
    readonly targetVersion?: string
    readonly migration?: StateMigration<any, any>
    readonly initialState: State
    readonly events: readonly Event[]
    readonly termination: readonly TerminationCondition[]
}


export type SimulationResult = {
    readonly finalState: State
    readonly stateHistory: readonly State[]
    readonly terminationReason: TerminationCondition
}

export interface Simulator {
    start(definition: SimulationDefinition): SimulationResult
}

// Simple Implementation (No Audit)
export class SimpleSimulator implements Simulator {
    constructor(
        private readonly governance: GovernanceEngine,
        private readonly transition: Transition<"v1", "v1">
    ) { }

    start(def: SimulationDefinition): SimulationResult {
        let current = def.initialState
        const history: State[] = [current]

        for (const event of def.events) {
            const next = this.transition.apply(current, event)

            const gov = this.governance.evaluate({
                type: "state",
                state: next
            })

            if (gov.decision === "reject") {
                return {
                    finalState: current,
                    stateHistory: history,
                    terminationReason: { type: "violation", severity: "critical" }
                }
            }

            current = next
            history.push(current)

            if (current.time.tick >= 3) {
                break
            }
        }

        return {
            finalState: current,
            stateHistory: history,
            terminationReason: { type: "maxTicks", limit: 3 }
        }
    }
}
