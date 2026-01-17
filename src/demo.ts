import type { State } from "@core/state"
import type { Event } from "@core/event"
import type { StateId, TransitionId, SimulationId } from "@shared/ids"
import { ConsumeEnergyTransition } from "@core/transition"
import { NoNegativeEnergyRule } from "@governance/rules/no-negative-energy"
import { BlockOnNegativeEnergyPolicy } from "@governance/policies/energy-policies"
import { PolicyAwareGovernanceEngine } from "@governance/engine"
import { AuditedSimulator } from "@engine/audited-simulator"
import { InMemoryAuditService } from "@audit/in-memory-audit-service"
import { verifyAuditChain } from "@audit/verify-chain"
import type { SimulationDefinition } from "@engine/simulation"

// Helper: Create Event
const consumeEnergy = (amount: number): Event => ({
    type: "CONSUME_ENERGY",
    payload: { amount },
    source: "simulation"
})

// Initial State
const initialState: State<"v1"> = {
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

// Audit Service
const audit = new InMemoryAuditService()

// Policy-Aware Governance Setup
const simulator = new AuditedSimulator(
    new PolicyAwareGovernanceEngine(
        [NoNegativeEnergyRule],
        [BlockOnNegativeEnergyPolicy]
    ),
    ConsumeEnergyTransition,
    audit
)

// Simulation Definition
const definition: SimulationDefinition = {
    id: "SIM-001" as SimulationId,
    version: "1.0",
    initialState,
    events: [
        consumeEnergy(3),
        consumeEnergy(4),
        consumeEnergy(5) // this will violate
    ],
    termination: [{ type: "maxTicks", limit: 3 }]
}

// Run
const result = simulator.start(definition)

// Output
console.log("=== Energy Demo Results ===")
console.log(`Final State: tick ${result.finalState.time.tick}`)
console.log(`Termination: ${result.terminationReason.type}`)
console.log("\nState History:")
result.stateHistory.forEach((state) => {
    const energy = state.data.entities["energy"] as { kind: "resource"; amount: number }
    console.log(`  tick ${state.time.tick}: energy = ${energy.amount}`)
})

console.log("\n=== Policy-Aware Audit Trail ===")
const auditTrail = audit.query({})
auditTrail.forEach((record) => {
    const actionDisplay = record.action.padEnd(25)
    const statusDisplay = record.result.status.padEnd(10)

    if (record.action === "policy.apply") {
        const policyId = record.subject.type === "policy" ? record.subject.id : "unknown"
        console.log(`tick ${record.timestamp.tick.toString().padStart(2)} → ${actionDisplay} (${policyId}) → ${statusDisplay}`)
    } else {
        console.log(`tick ${record.timestamp.tick.toString().padStart(2)} → ${actionDisplay} → ${statusDisplay}`)
    }
})

console.log("\n=== Hash Chain Verification ===")
const isValid = verifyAuditChain(auditTrail)
console.log(`Chain integrity: ${isValid ? "✅ VALID" : "❌ BROKEN"}`)

console.log("\n✅ Enterprise-Grade Governance:")
console.log("- Rules declare truth (pure evaluation)")
console.log("- Policies decide consequences (warn vs block)")
console.log("- Governance applies policies (authoritative)")
console.log("- Simulator obeys decisions (deterministic)")
console.log("- Audit records everything (tamper-evident)")
