import { AuditRecord } from "./audit-record"
import { SimulationId } from "../shared/ids"

export type AuditQuery = {
    simulationId?: SimulationId
    action?: string
}

export interface AuditService {
    record(entry: AuditRecord): void
    query(filter: AuditQuery): readonly AuditRecord[]
}
