export type ScenarioClass =
    | "happy-path"
    | "warning-escalation"
    | "blocking-violation"
    | "stability-termination"
    | "max-ticks-termination"
    | "edge-case"
    | "failure-mode"

export type GoldenScenario = {
    id: string
    description: string
    class: ScenarioClass
    run(): {
        simulationId: string
        auditHashes: readonly string[]
    }
}

export type FailureClass =

    | "governance-critical"
    | "policy-misconfiguration"
    | "migration-failure"
    | "engine-guardrail"
    | "audit-integrity"

export type FailureScenario = {
    id: string
    class: FailureClass
    description: string

    run(): {
        fromVersion: "v1" | "v2"
        toVersion: "v1" | "v2"
        auditHashes: readonly string[]
        auditRecords?: any[]
        termination: {
            reason: string
            phase: "INITIALIZED" | "RUNNING" | "TERMINATING"
        }
    }
}

export type GoldenSnapshot = {
    scenarioId: string
    class: ScenarioClass | FailureClass
    description: string
    fromVersion?: string
    toVersion?: string
    auditHashes: string[]
    auditRecords?: any[]
    termination?: {
        reason: string
        phase: string
    }
}


