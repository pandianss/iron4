import { RegulatoryAttestation, ExecutiveCredibilityReport, BacktestResult, generateRegulatoryAttestation } from "./chaos";
import { AuditAction } from "./audit-record";

/**
 * Continuous Attestation Service
 * Orchestrates periodic validation and proof generation for resilience governance.
 */
export class ContinuousAttestationService {
    private attestations: RegulatoryAttestation[] = [];

    constructor(
        private integrityKey: string,
        private policyVersion: string
    ) { }

    /**
     * Executes an attestation cycle.
     * Usually called after a major backtest or release window.
     */
    public attestWindow(
        windowId: string,
        credibility: ExecutiveCredibilityReport,
        backtest: BacktestResult
    ): RegulatoryAttestation {
        const attestation = generateRegulatoryAttestation(
            windowId,
            credibility,
            backtest,
            this.policyVersion,
            this.integrityKey
        );

        this.attestations.push(attestation);
        return attestation;
    }

    public getLatestAttestation(): RegulatoryAttestation | undefined {
        return this.attestations[this.attestations.length - 1];
    }

    public verifyIntegrity(attestation: RegulatoryAttestation): boolean {
        // In a real system, this would verify a cryptographic signature.
        // Here we check if the proof follows our internal format.
        return attestation.integrityProof.startsWith("PROOF-") &&
            attestation.policyVersion === this.policyVersion;
    }
}
