import type { SimulationId } from "../shared/ids"
import type { SimulationDefinition, SimulationPhase, Simulator } from "../engine/simulation"

export interface SimulationService {
    start(def: SimulationDefinition): SimulationId
    pause(id: SimulationId): void
    resume(id: SimulationId): void
    terminate(id: SimulationId, reason?: string): void
    getStatus(id: SimulationId): SimulationPhase
}

// Default Implementation
export class DefaultSimulationService implements SimulationService {
    constructor(
        private readonly simulator: Simulator
    ) { }

    start(def: SimulationDefinition): SimulationId {
        this.simulator.start(def)
        return def.id
    }

    pause(): void { throw new Error("Not implemented") }
    resume(): void { throw new Error("Not implemented") }
    terminate(): void { throw new Error("Not implemented") }
    getStatus(): never { throw new Error("Not implemented") }
}
