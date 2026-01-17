import type { Event } from "@core/event"

export const consumeEnergy = (amount: number): Event => ({
    type: "CONSUME_ENERGY",
    payload: { amount },
    source: "simulation"
})
