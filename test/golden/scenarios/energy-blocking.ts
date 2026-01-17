import { GoldenScenario } from "../types"
import { runEnergySimulation } from "../../support/run-energy-demo"
import { consumeEnergy } from "../../support/events"

export const EnergyBlockingScenario: GoldenScenario = {
    id: "energy-blocking",
    description: "Negative energy triggers blocking policy",
    class: "blocking-violation",

    run() {
        const { simulationId, auditTrail } = runEnergySimulation([
            consumeEnergy(5),
            consumeEnergy(6) // triggers NoNegativeEnergyRule -> BlockOnNegativeEnergyPolicy
        ])

        return {
            simulationId,
            auditHashes: auditTrail.map(r => r.integrity.hash)
        }
    }
}
