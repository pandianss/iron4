import { GoldenScenario } from "../types"
import { runEnergySimulation } from "../../support/run-energy-demo"
import { consumeEnergy } from "../../support/events"

export const EnergyMaxTicksScenario: GoldenScenario = {
    id: "energy-max-ticks",
    description: "Simulation terminates due to max ticks limit",
    class: "max-ticks-termination",

    run() {
        const { simulationId, auditTrail } = runEnergySimulation([
            consumeEnergy(1),
            consumeEnergy(1),
            consumeEnergy(1),
            consumeEnergy(1),
            consumeEnergy(1)
        ], [{ type: "maxTicks", limit: 3 }])

        return {
            simulationId,
            auditHashes: auditTrail.map(r => r.integrity.hash)
        }
    }
}
