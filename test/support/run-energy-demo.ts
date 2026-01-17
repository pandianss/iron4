import { InMemoryAuditService } from "@audit/in-memory-audit-service"
import { AuditedSimulator } from "@engine/audited-simulator"
import { PolicyAwareGovernanceEngine } from "@governance/engine"
import { NoNegativeEnergyRule } from "@governance/rules/no-negative-energy"
import { WarnOnLowEnergyPolicy, BlockOnNegativeEnergyPolicy } from "@governance/policies/energy-policies"
import { ConsumeEnergyTransition } from "@core/transition"
import { initialEnergyState } from "./initial-state"
import { consumeEnergy } from "./events"
import type { SimulationId } from "@shared/ids"

export function runEnergySimulation(events: any[], termination: any[] = [{ type: "maxTicks", limit: 10 }]) {
    const audit = new InMemoryAuditService()

    const governance = new PolicyAwareGovernanceEngine(
        [NoNegativeEnergyRule],
        [WarnOnLowEnergyPolicy, BlockOnNegativeEnergyPolicy]
    )

    const simulator = new AuditedSimulator(
        governance,
        ConsumeEnergyTransition,
        audit
    )

    simulator.start({
        id: "SIM-ENERGY-GENERIC" as SimulationId,
        version: "1.0",
        initialState: initialEnergyState,
        events,
        termination
    })

    return {
        simulationId: "SIM-ENERGY-GENERIC",
        auditTrail: audit.query({})
    }
}

