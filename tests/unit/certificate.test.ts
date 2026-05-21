import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  isDbConfigured: () => false,
  getDb: () => null,
}));

vi.mock("@/lib/payments/access", () => ({
  hasAccess: vi.fn(async () => false),
}));

beforeEach(() => {
  vi.resetModules();
});

describe("certificate gate (stub mode)", () => {
  it("getCaseStudy returns null when DB is not configured", async () => {
    const { getCaseStudy } = await import("@/lib/courses/certificate");
    const cs = await getCaseStudy("00000000-0000-0000-0000-000000000000");
    expect(cs).toBeNull();
  });

  it("caseStudyStatus returns 'missing' for null input", async () => {
    const { caseStudyStatus } = await import("@/lib/courses/certificate");
    expect(caseStudyStatus(null)).toBe("missing");
  });

  it("caseStudyStatus returns 'pending' for unapproved cases", async () => {
    const { caseStudyStatus } = await import("@/lib/courses/certificate");
    expect(
      caseStudyStatus({
        userId: "u",
        bodyUk: "body",
        videoUrl: null,
        approved: false,
        submittedAt: new Date(),
        approvedAt: null,
      })
    ).toBe("pending");
  });

  it("caseStudyStatus returns 'approved' once approved=true", async () => {
    const { caseStudyStatus } = await import("@/lib/courses/certificate");
    expect(
      caseStudyStatus({
        userId: "u",
        bodyUk: "body",
        videoUrl: null,
        approved: true,
        submittedAt: new Date(),
        approvedAt: new Date(),
      })
    ).toBe("approved");
  });

  it("canIssueCertificate is false when DB is not configured", async () => {
    const { canIssueCertificate } = await import("@/lib/courses/certificate");
    const ok = await canIssueCertificate(
      "00000000-0000-0000-0000-000000000000"
    );
    expect(ok).toBe(false);
  });
});
