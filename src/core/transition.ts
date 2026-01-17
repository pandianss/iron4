import type { State, StateVersion } from "./state"
import type { Event } from "./event"
import type { TransitionId } from "../shared/ids"

export type Transition<I extends StateVersion = StateVersion, O extends StateVersion = StateVersion> = {
    readonly id: TransitionId
    readonly fromVersion: I
    readonly toVersion: O
    apply(state: State<I>, event: Event): State<O>
}

// Example: ConsumeEnergyTransition
export const ConsumeEnergyTransition: Transition<"v1", "v1"> = {
    id: "T-CONSUME" as TransitionId,
    fromVersion: "v1",
    toVersion: "v1",

    apply(state, event) {
        if (event.type !== "CONSUME_ENERGY") return state

        const energy = state.data.entities["energy"] as { kind: "resource"; amount: number } | undefined
        if (!energy) return state

        const amount = event.payload["amount"] as number

        return {
            ...state,
            time: { ...state.time, tick: state.time.tick + 1 },
            data: {
                ...state.data,
                entities: {
                    ...state.data.entities,
                    energy: {
                        kind: "resource",
                        amount: energy.amount - amount
                    }
                }
            },
            meta: {
                ...state.meta,
                parentStateId: state.id,
                transitionId: this.id,
                hash: `hash-${state.time.tick + 1}`
            }
        }
    }
}
