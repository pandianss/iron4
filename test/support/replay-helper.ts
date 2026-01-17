import { InMemoryAuditService } from "@audit/in-memory-audit-service"
import { AuditedSimulator } from "@engine/audited-simulator"
import { PolicyAwareGovernanceEngine } from "@governance/engine"
import { NoNegativeEnergyRule } from "@governance/rules/no-negative-energy"
import { WarnOnLowEnergyPolicy, BlockOnNegativeEnergyPolicy } from "@governance/policies/energy-policies"
import { ConsumeEnergyTransition } from "@core/transition"
import { initialEnergyState } from "./initial-state"
import { GoldenScenario } from "../golden/types"
import { StateMigration } from "@core/migration"
import { consumeEnergy } from "./events"
import type { SimulationId } from "@shared/ids"


export function replaySimulation(options: {
    scenario: GoldenScenario,
    migrate?: StateMigration<any, any>,
    targetVersion?: string,
    overrideRules?: any[],
    overridePolicies?: any[]
}) {
    return runEnergySimulationWithMigration(options.scenario, options.migrate, options.overrideRules, options.overridePolicies)
}


function runEnergySimulationWithMigration(
    scenario: GoldenScenario,
    migration?: StateMigration<any, any>,
    overrideRules?: any[],
    overridePolicies?: any[]
) {
    const audit = new InMemoryAuditService()
    const governance = new PolicyAwareGovernanceEngine(
        overrideRules ?? [NoNegativeEnergyRule],
        overridePolicies ?? [WarnOnLowEnergyPolicy, BlockOnNegativeEnergyPolicy]
    )
    const simulator = new AuditedSimulator(
        governance,
        ConsumeEnergyTransition,
        audit
    )

    // Selection logic for base events
    const events = scenario.id === "energy-blocking"
        ? [consumeEnergy(5), consumeEnergy(6)]
        : [consumeEnergy(2), consumeEnergy(3), consumeEnergy(1)] // Default to happy path events

    const result = simulator.start({
        id: "SIM-CROSS-VERSION" as SimulationId,
        version: "v1",
        initialState: initialEnergyState,
        events: events,
        termination: [{ type: "maxTicks", limit: 10 }],
        migration
    })

    const auditRecords = audit.query({})
    const resAudit = auditRecords.find(r => r.action === "terminate")
    const auditResult = resAudit?.result as any

    let reason = "success"
    if (auditResult?.status === "rejected" || auditResult?.status === "failure") {
        if (auditResult.errorCode === "MIGRATION_FAIL") reason = "State migration failure"
        else if (auditResult.errorCode === "POLICY_MISCONFIG") reason = "Unsafe governance configuration"
        else reason = auditResult.reason || "failure"
    }

    return {
        simulationId: "SIM-CROSS-VERSION",
        auditHashes: auditRecords.map(r => r.integrity.hash),
        fromVersion: "v1" as const,
        toVersion: "v2" as const,
        termination: {
            reason,
            phase: (reason === "State migration failure") ? "INITIALIZED" : "RUNNING"
        },
        auditRecords,
        rawResult: result
    }
}


