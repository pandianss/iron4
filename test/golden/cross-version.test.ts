import { describe, it, expect } from "vitest"
import { EnergyBlockingScenario } from "./scenarios/energy-blocking"
import { MigrateV1toV2 } from "../../src/core/migration"
import { replaySimulation } from "../support/replay-helper"
import * as fs from "fs"
import * as path from "path"

describe("Cross-version replay v1 → v2", () => {
    it("preserves behavioral semantics across migration", () => {
        const actual = replaySimulation({
            scenario: EnergyBlockingScenario,
            migrate: MigrateV1toV2,
            targetVersion: "v2"
        })

        const snapshotPath = path.join(__dirname, "snapshots", "cross-version-v1-v2.golden.json")
        const shouldUpdate = process.env["UPDATE_GOLDEN"] === "true"

        if (!fs.existsSync(snapshotPath) || shouldUpdate) {
            const snapshot = {
                scenarioId: "energy-blocking-cross-version",
                fromVersion: "v1",
                toVersion: "v2",
                description: "Negative energy triggers blocking policy after v1->v2 migration",
                auditHashes: actual.auditHashes
            }
            if (!fs.existsSync(path.dirname(snapshotPath))) {
                fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
            }
            fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
            return
        }

        const golden = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"))
        expect(actual.auditHashes).toEqual(golden.auditHashes)

        // Check that the migration record is present (usually at index 1 after initialize)
        // We expect: [initialize, migrate.state, transition.propose, ...]
        // But let's just check if it exists in the output. 
        // This is verified by the hash chain equality anyway.
    })
})
