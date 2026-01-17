import { SimulationId } from "../shared/ids"
import { SimulationResult } from "../engine/simulation"

export interface SimulationRepository {
    save(id: SimulationId, result: SimulationResult): void
    load(id: SimulationId): SimulationResult | null
}
