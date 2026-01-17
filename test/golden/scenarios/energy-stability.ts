import { GoldenScenario } from "../types"
import { runEnergySimulation } from "../../support/run-energy-demo"
import { consumeEnergy } from "../../support/events"

export const EnergyStabilityScenario: GoldenScenario = {
    id: "energy-stability",
    description: "Simulation terminates normally after all events are processed",
    class: "stability-termination",

    run() {
        const { simulationId, auditTrail } = runEnergySimulation([
            consumeEnergy(1),
            consumeEnergy(1)
        ], [{ type: "maxTicks", limit: 10 }])

        return {
            simulationId,
            auditHashes: auditTrail.map(r => r.integrity.hash)
        }
    }
}
