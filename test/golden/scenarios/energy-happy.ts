import { GoldenScenario } from "../types"
import { runEnergySimulation } from "../../support/run-energy-demo"
import { consumeEnergy } from "../../support/events"

export const EnergyHappyScenario: GoldenScenario = {
    id: "energy-happy",
    description: "Energy consumption remains within bounds",
    class: "happy-path",

    run() {
        const { simulationId, auditTrail } = runEnergySimulation([
            consumeEnergy(2),
            consumeEnergy(3),
            consumeEnergy(1)
        ])

        return {
            simulationId,
            auditHashes: auditTrail.map(r => r.integrity.hash)
        }
    }
}
