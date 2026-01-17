export type Event = Readonly<{
    type: string
    payload: Readonly<Record<string, unknown>>
    source: "user" | "system" | "simulation"
    intent?: string
}>
