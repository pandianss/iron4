import type { AuditRecord } from "./audit-record"

export function verifyAuditChain(records: readonly AuditRecord[]): boolean {
    if (records.length === 0) return true

    // Genesis record must have no previousHash
    if (records[0]?.integrity.previousHash !== undefined) {
        return false
    }

    // Each subsequent record must reference the previous hash
    for (let i = 1; i < records.length; i++) {
        if (records[i]?.integrity.previousHash !== records[i - 1]?.integrity.hash) {
            return false
        }
    }

    return true
}
