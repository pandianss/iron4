import {
    AuditId,
    SimulationId,
    StateId,
    TransitionId,
    RuleId,
    PolicyId,
    UserId
} from "../shared/ids"
import { LogicalTime } from "../core/state"

export type Actor =
    | { type: "system" }
    | { type: "simulation"; id: SimulationId }
    | { type: "user"; id: UserId }
    | { type: "external"; source: string }

export type AuditAction =
    | "initialize"
    | "migrate.state"
    | "transition.propose"

    | "transition.accept"
    | "transition.reject"
    | "governance.evaluate"
    | "policy.apply"
    | "pause"
    | "resume"
    | "terminate"
    | "fail"
    | "release.gate.evaluate"
    | "release.exception.requested"
    | "release.exception.approved"
    | "release.exception.applied"
    | "release.exception.expired"
    | "exception.escalation.triggered"
    | "exception.escalation.applied"
    | "exception.escalation.resolved"
    | "exception.prediction.triggered"
    | "exception.prediction.escalated"
    | "exception.prediction.resolved"
    | "exception.prediction.band.evaluated"
    | "exception.prediction.scenario-band.evaluated"
    | "scenario.sla.triggered"
    | "scenario.sla.updated"
    | "scenario.sla.breached"
    | "scenario.sla.resolved"
    | "scenario.mitigation.simulated"
    | "scenario.mitigation.accepted"
    | "scenario.mitigation.rejected"
    | "scenario.mitigation.suggested"
    | "scenario.mitigation.compared"
    | "scenario.rollback.simulated"
    | "scenario.rollback.accepted"
    | "scenario.rollback.rejected"
    | "scenario.hybrid.analyzed"
    | "scenario.hybrid.accepted"
    | "scenario.hybrid.rejected"
    | "scenario.playbook.suggested"
    | "scenario.playbook.applied"
    | "scenario.playbook.revalidated"
    | "scenario.playbook.retired"
    | "coupling.edge.discovered"
    | "coupling.edge.updated"
    | "coupling.edge.retired"
    | "rollout.plan.generated"
    | "rollout.phase.started"
    | "rollout.phase.stabilized"
    | "rollout.aborted"
    | "rollout.completed"
    | "chaos.experiment.planned"
    | "chaos.experiment.simulated"
    | "chaos.experiment.started"
    | "chaos.experiment.aborted"
    | "chaos.experiment.completed"
    | "chaos.confidence.updated"
    | "chaos.schedule.computed"
    | "chaos.schedule.approved"
    | "chaos.schedule.executed"
    | "chaos.budget.allocated"
    | "chaos.budget.consumed"
    | "chaos.budget.throttled"
    | "chaos.budget.resize.evaluated"
    | "chaos.budget.resized"
    | "chaos.budget.forecast.generated"
    | "chaos.roi.calculated"

    | "chaos.pattern.retired"
    | "chaos.budget.adjusted"

















export type AuditSubject =
    | { type: "state"; id: StateId }
    | { type: "transition"; id: TransitionId }
    | { type: "rule"; id: RuleId }
    | { type: "policy"; id: PolicyId }
    | { type: "simulation"; id: SimulationId }

export type AuditResult =
    | { status: "success" }
    | { status: "rejected"; reason: string }
    | { status: "failure"; errorCode: string; message: string }

export type IntegrityProof = {
    readonly hash: string
    readonly previousHash?: string
}

export type AuditRecord = {
    readonly id: AuditId
    readonly simulationId: SimulationId
    readonly timestamp: LogicalTime
    readonly actor: Actor
    readonly action: AuditAction
    readonly subject: AuditSubject
    readonly result: AuditResult
    readonly integrity: IntegrityProof
}
