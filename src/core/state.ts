import { StateId, TransitionId } from "../shared/ids"

export type LogicalTime = {
    readonly tick: number
    readonly epoch: number
}

export type StateVersion = "v1" | "v2"

export type Context = {
    readonly scenarioId: string
    readonly assumptions: Readonly<Record<string, string | number | boolean>>
    readonly constraints: readonly string[]
}

export type StateMeta = {
    readonly createdBy: "simulation" | "user" | "system"
    readonly parentStateId?: StateId
    readonly transitionId: TransitionId
    readonly hash: string
}

export type State<V extends StateVersion = StateVersion> = Readonly<{
    id: StateId
    version: V
    time: LogicalTime
    context: Context
    data: StateData<V>
    meta: StateMeta
}>

export type StateData<V extends StateVersion> =
    V extends "v1" ? StateDataV1 :
    V extends "v2" ? StateDataV2 :
    never

export type StateDataV1 = {
    readonly entities: Readonly<Record<string, unknown>>
    readonly metrics: Readonly<Record<string, number>>
    readonly flags: Readonly<Record<string, boolean>>
}

export type StateDataV2 = {
    readonly entities: Readonly<Record<string, {
        kind: string
        amount: number
        floor?: number
    } | unknown>>
    readonly metrics: Readonly<Record<string, number>>
    readonly flags: Readonly<Record<string, boolean>>
}

