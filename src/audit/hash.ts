export function hashAudit(
    previousHash: string | undefined,
    payload: unknown
): string {
    return JSON.stringify({
        previousHash: previousHash ?? null,
        payload
    })
}
