import type { AuditService, AuditQuery } from "./audit-service"
import type { AuditRecord } from "./audit-record"

export class InMemoryAuditService implements AuditService {
    private readonly records: AuditRecord[] = []

    record(entry: AuditRecord): void {
        this.records.push(entry)
    }

    query(_filter: AuditQuery): readonly AuditRecord[] {
        return this.records
    }
}
