import { describe, it, expect } from "vitest";
import {
    GovernanceKernel,
    IndividualTrustProfile,
    AuthorityToken,
    EnterpriseEntity,
    updateTrustProfile,
    validateAuthority
} from "../../src/audit/governance-stack";

describe("Constitutional Operating System (Layers 2-6)", () => {
    it("evolves Individual Trust Profile and expands Authority", () => {
        let profile: IndividualTrustProfile = {
            personId: "eng-01",
            confidenceImpactScore: 0,
            forecastAccuracy: 0.5,
            violationRate: 0,
            currentTrustScore: 20
        };

        // 1. Individual performs high-value action (impact +10, accuracy 0.9)
        profile = updateTrustProfile(profile, 10, 0.9, 0);

        // Trust score should increase
        expect(profile.currentTrustScore).toBeGreaterThan(20);
        expect(profile.confidenceImpactScore).toBe(10);
        expect(profile.forecastAccuracy).toBe(0.62); // (0.5*0.7 + 0.9*0.3)

        // 2. Individual continues to perform well
        profile = updateTrustProfile(profile, 10, 0.95, 0);
        expect(profile.currentTrustScore).toBeGreaterThan(60);
    });

    it("enforces Conditional Authority and Mechanical Consequences", () => {
        const kernel = new GovernanceKernel();
        const asset: EnterpriseEntity = {
            entityId: "prod-db",
            type: "asset",
            confidenceScore: 70,
            status: "active"
        };
        kernel.registerEntity(asset);

        // Token requires 80 confidence
        const token: AuthorityToken = {
            tokenId: "tok-01",
            actorId: "eng-01",
            action: "deploy-to-prod",
            scope: "global",
            conditions: [{ type: "confidence-threshold", value: 80 }],
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString()
        };

        // 1. Attempt action when confidence is too low (70 < 80)
        const result1 = kernel.executeAction("eng-01", token, {
            confidenceScore: 70,
            recentViolations: 0,
            budgetAvailable: 100
        });

        expect(result1.success).toBe(false);
        expect(result1.event.outcome).toBe("violation");
        expect(result1.event.consequence?.type).toBe("mandatory-review");

        // 2. Attempt action that causes safety breach
        const breachToken = { ...token, action: "safety-breach-attempt" };
        const result2 = kernel.executeAction("eng-01", breachToken, {
            confidenceScore: 70,
            recentViolations: 1,
            budgetAvailable: 100
        });

        expect(result2.event.consequence?.type).toBe("authority-suspension");

        // Verify entity status was updated in kernel
        // (This would require a way to inspect kernel state or mock)
    });
});
