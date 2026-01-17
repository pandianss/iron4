import type { State } from "@core/state"
import type { StateId, TransitionId } from "@shared/ids"

export const initialEnergyState: State<"v1"> = {
    id: "state-0" as StateId,
    version: "v1",
    time: { tick: 0, epoch: 0 },
    context: {
        scenarioId: "energy-demo",
        assumptions: {},
        constraints: []
    },
    data: {
        entities: {
            energy: { kind: "resource", amount: 10 }
        },
        metrics: {},
        flags: {}
    },
    meta: {
        createdBy: "system",
        transitionId: "init" as TransitionId,
        hash: "hash-0"
    }
}
