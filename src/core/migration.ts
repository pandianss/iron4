import { State, StateVersion } from "./state"

export type StateMigration<I extends StateVersion, O extends StateVersion> = {
    from: I
    to: O
    migrate(state: State<I>): State<O>
}

export const MigrateV1toV2: StateMigration<"v1", "v2"> = {
    from: "v1",
    to: "v2",

    migrate(state) {
        const energy = state.data.entities["energy"] as any
        return {
            ...state,
            version: "v2",
            data: {
                ...state.data,
                entities: {
                    ...state.data.entities,
                    energy: {
                        ...energy,
                        floor: 0
                    }
                }
            }
        }
    }
}
