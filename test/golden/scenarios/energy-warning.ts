import { GoldenScenario } from "../types"
import { runEnergySimulation } from "../../support/run-energy-demo"
import { consumeEnergy } from "../../support/events"

export const EnergyWarningScenario: GoldenScenario = {
    id: "energy-warning",
    description: "Low energy triggers warning but continues",
    class: "warning-escalation",

    run() {
        const { simulationId, auditTrail } = runEnergySimulation([
            consumeEnergy(7), // Should trigger WarnOnLowEnergyPolicy (threshold 3 in initial-state.ts? No, let's check initial-state)
            consumeEnergy(1)
        ])

        return {
            simulationId,
            auditHashes: auditTrail.map(r => r.integrity.hash)
        }
    }
}
