import { describe, it, expect } from "vitest"
import { EnergyHappyScenario } from "./scenarios/energy-happy"
import { EnergyWarningScenario } from "./scenarios/energy-warning"
import { EnergyBlockingScenario } from "./scenarios/energy-blocking"
import { EnergyMaxTicksScenario } from "./scenarios/energy-max-ticks"
import { EnergyStabilityScenario } from "./scenarios/energy-stability"
import * as fs from "fs"
import * as path from "path"

const scenarios = [
    EnergyHappyScenario,
    EnergyWarningScenario,
    EnergyBlockingScenario,
    EnergyMaxTicksScenario,
    EnergyStabilityScenario
]

describe("Golden replay suite", () => {
    for (const scenario of scenarios) {
        it(`${scenario.id} (${scenario.class})`, () => {
            const actual = scenario.run()

            const snapshotPath = path.join(__dirname, "snapshots", `${scenario.id}.golden.json`)
            const shouldUpdate = process.env["UPDATE_GOLDEN"] === "true"

            if (!fs.existsSync(snapshotPath) || shouldUpdate) {
                // Auto-generate if missing or if update requested
                const snapshot = {
                    scenarioId: scenario.id,
                    class: scenario.class,
                    description: scenario.description,
                    auditHashes: actual.auditHashes
                }
                if (!fs.existsSync(path.dirname(snapshotPath))) {
                    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
                }
                fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
                return // skip check for new file or update
            }


            const golden = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"))
            expect(actual.auditHashes).toEqual(golden.auditHashes)
        })
    }
})
