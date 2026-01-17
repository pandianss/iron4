import type { Simulator, SimulationDefinition, SimulationResult } from "./simulation"
import type { GovernanceEngine } from "../governance/engine"
import type { Transition } from "../core/transition"
import type { AuditService } from "../audit/audit-service"
import type { AuditRecord } from "../audit/audit-record"
import type { AuditId, SimulationId } from "../shared/ids"
import { hashAudit } from "../audit/hash"

export class AuditedSimulator implements Simulator {
    private tick = 0
    private lastHash: string | undefined = undefined

    constructor(
        private readonly governance: GovernanceEngine,
        private readonly transition: Transition<"v1", "v1">,
        private readonly audit: AuditService
    ) { }

    start(def: SimulationDefinition): SimulationResult {
        let current = def.initialState
        const history = [current]

        this.emitAudit(def.id, {
            action: "initialize",
            subject: { type: "simulation", id: def.id },
            result: { status: "success" }
        })

        if (def.migration && def.initialState.version === def.migration.from) {
            try {
                current = def.migration.migrate(current)

                this.emitAudit(def.id, {
                    action: "migrate.state",
                    subject: { type: "state", id: current.id },
                    result: {
                        status: "success",
                        reason: `State upgraded ${def.migration.from} → ${def.migration.to}`
                    }
                })
            } catch (error: any) {
                this.emitAudit(def.id, {
                    action: "terminate",
                    subject: { type: "simulation", id: def.id },
                    result: { status: "failure", errorCode: "MIGRATION_FAIL", message: error.message }
                })
                return {
                    finalState: current,
                    stateHistory: history,
                    terminationReason: { type: "violation", severity: "critical" }
                }
            }
        }



        for (const event of def.events) {
            const maxTicks = def.termination.find(t => t.type === "maxTicks")?.limit
            if (maxTicks !== undefined && current.time.tick >= maxTicks) break

            this.emitAudit(def.id, {
                action: "transition.propose",
                subject: { type: "state", id: current.id },
                result: { status: "success" }
            })

            const proposed = this.transition.apply(current, event)

            const evaluation = this.governance.evaluate({
                type: "state",
                state: proposed
            })

            this.emitAudit(def.id, {
                action: "governance.evaluate",
                subject: { type: "state", id: proposed.id },
                result:
                    evaluation.decision === "accept"
                        ? { status: "success" }
                        : { status: "rejected", reason: "Policy escalation" }
            })

            // Emit policy audit records
            for (const policyId of evaluation.appliedPolicies) {
                this.emitAudit(def.id, {
                    action: "policy.apply",
                    subject: { type: "policy", id: policyId },
                    result: {
                        status: evaluation.decision === "reject" ? "rejected" : "success",
                        reason:
                            evaluation.decision === "reject"
                                ? "Blocking policy applied"
                                : "Warning policy applied"
                    }
                })
            }

            // Engine Guardrail: Check for critical violations that missed a blocking policy
            const hasCriticalViolation = evaluation.results.some(r => r.status === "violation" && r.severity === "critical")
            const isBlocked = evaluation.decision === "reject"

            if (hasCriticalViolation && !isBlocked) {

                this.emitAudit(def.id, {
                    action: "terminate",
                    subject: { type: "simulation", id: def.id },
                    result: {
                        status: "failure",
                        errorCode: "POLICY_MISCONFIG",
                        message: "Critical violation detected without blocking policy"
                    }
                })
                return {
                    finalState: current,
                    stateHistory: history,
                    terminationReason: { type: "violation", severity: "critical" }
                }
            }

            if (evaluation.decision === "reject") {

                this.emitAudit(def.id, {
                    action: "transition.reject",
                    subject: { type: "state", id: proposed.id },
                    result: { status: "rejected", reason: "Blocked by policy" }
                })

                this.emitAudit(def.id, {
                    action: "terminate",
                    subject: { type: "simulation", id: def.id },
                    result: { status: "rejected", reason: "Critical policy escalation" }
                })

                return {
                    finalState: current,
                    stateHistory: history,
                    terminationReason: { type: "violation", severity: "critical" }
                }
            }

            current = proposed
            history.push(current)

            this.emitAudit(def.id, {
                action: "transition.accept",
                subject: { type: "state", id: current.id },
                result: { status: "success" }
            })
        }

        this.emitAudit(def.id, {
            action: "terminate",
            subject: { type: "simulation", id: def.id },
            result: { status: "success" }
        })

        const maxTicksLimit = def.termination.find(t => t.type === "maxTicks")?.limit ?? 0

        return {
            finalState: current,
            stateHistory: history,
            terminationReason: { type: "maxTicks", limit: maxTicksLimit }
        }

    }

    private emitAudit(
        simulationId: SimulationId,
        partial: Omit<AuditRecord, "id" | "timestamp" | "actor" | "integrity" | "simulationId">
    ) {
        const hash = hashAudit(this.lastHash, partial)

        const record: AuditRecord = {
            id: `AUD-${this.tick}` as AuditId,
            simulationId,
            timestamp: {
                tick: this.tick,
                epoch: 0
            },
            actor: { type: "simulation", id: simulationId },
            integrity: {
                hash,
                ...(this.lastHash !== undefined && { previousHash: this.lastHash })
            },
            ...partial
        }

        this.audit.record(record)

        this.lastHash = hash
        this.tick += 1
    }
}
