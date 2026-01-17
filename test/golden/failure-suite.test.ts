import { describe, it, expect } from "vitest"
import {
    GovernanceFailureAfterMigration,
    MigrationFailureScenario,
    PolicyMisconfigurationScenario
} from "./scenarios/failure-scenarios"
import * as fs from "fs"
import * as path from "path"
import { explainAuditDiff } from "../../src/audit/diff"

const scenarios = [
    GovernanceFailureAfterMigration,
    MigrationFailureScenario,
    PolicyMisconfigurationScenario
]

describe("Failure-injection cross-version replay", () => {
    for (const scenario of scenarios) {
        it(`${scenario.id} (${scenario.class})`, () => {
            const actual = scenario.run()

            const snapshotPath = path.join(__dirname, "snapshots", `${scenario.id}.golden.json`)
            const shouldUpdate = process.env["UPDATE_GOLDEN"] === "true"

            if (!fs.existsSync(snapshotPath) || shouldUpdate) {
                const snapshot = {
                    scenarioId: scenario.id,
                    class: scenario.class,
                    description: scenario.description,
                    fromVersion: actual.fromVersion,
                    toVersion: actual.toVersion,
                    auditHashes: actual.auditHashes,
                    auditRecords: actual.auditRecords,
                    termination: actual.termination
                }
                if (!fs.existsSync(path.dirname(snapshotPath))) {
                    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
                }
                fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
                return
            }


            const golden = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"))

            try {
                expect(actual.auditHashes).toEqual(golden.auditHashes)
                expect(actual.termination).toEqual(golden.termination)
            } catch (error) {
                if (actual.auditRecords && (golden as any).auditRecords) {
                    const diff = explainAuditDiff((golden as any).auditRecords, actual.auditRecords)
                    if (diff) {
                        console.error("Semantic Audit Diff:", JSON.stringify(diff, null, 2))
                    }
                }
                throw error
            }
        })
    }
})
