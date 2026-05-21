import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("next/cache");
});

describe("getOverviewMetrics (stub mode)", () => {
  it("returns safe zeros when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    // unstable_cache wraps the worker — replace with a passthrough so we
    // can re-invoke between asserts.
    vi.doMock("next/cache", () => ({
      unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
    }));

    const { getOverviewMetrics } = await import("@/lib/admin/metrics");
    const m = await getOverviewMetrics();

    expect(m.newLeads24h).toBe(0);
    expect(m.conversion30d).toBeNull();
    expect(m.paymentsTodayUahCents).toBe(0);
    expect(m.activeLevel0).toBe(0);
    expect(m.activeLevel1).toBe(0);
    expect(m.activeLevel2).toBe(0);
    expect(m.casesPending).toBe(0);
    expect(m.webhookErrors7d).toBeNull();
    expect(typeof m.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(m.generatedAt))).toBe(false);
  });
});

describe("getOverviewMetrics (live mode)", () => {
  it("computes counters and conversion from query results", async () => {
    const sqlMock = (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      if (text.includes("from leads") && text.includes("interval '24 hours'")) {
        return Promise.resolve([{ n: 13 }]);
      }
      if (text.includes("from payments\n          where status = 'success'\n            and currency = 'UAH'\n            and created_at >= now() - interval '30 days'")) {
        return Promise.resolve([{ paid: 4, leads: 80 }]);
      }
      if (text.includes("coalesce(sum(amount_cents)")) {
        return Promise.resolve([{ cents: "150000" }]);
      }
      if (text.includes("from enrollments") && text.includes("'level-0'")) {
        return Promise.resolve([{ n: 42 }]);
      }
      if (text.includes("from enrollments") && text.includes("'level-1'")) {
        return Promise.resolve([{ n: 21 }]);
      }
      if (text.includes("from access") && text.includes("'level-2'")) {
        return Promise.resolve([{ n: 7 }]);
      }
      if (text.includes("from cases")) {
        return Promise.resolve([{ n: 3 }]);
      }
      return Promise.resolve([]);
    };

    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("next/cache", () => ({
      unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
    }));

    const { getOverviewMetrics } = await import("@/lib/admin/metrics");
    const m = await getOverviewMetrics();

    expect(m.newLeads24h).toBe(13);
    expect(m.conversion30d).toBeCloseTo(4 / 80);
    expect(m.paymentsTodayUahCents).toBe(150000);
    expect(m.activeLevel0).toBe(42);
    expect(m.activeLevel1).toBe(21);
    expect(m.activeLevel2).toBe(7);
    expect(m.casesPending).toBe(3);
    expect(m.webhookErrors7d).toBeNull();
  });

  it("returns null conversion when no leads in the window", async () => {
    const sqlMock = (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      if (text.includes("from leads") && text.includes("interval '24 hours'")) {
        return Promise.resolve([{ n: 0 }]);
      }
      if (text.includes("(select count(*)::int from payments")) {
        return Promise.resolve([{ paid: 0, leads: 0 }]);
      }
      return Promise.resolve([{ n: 0 }, { cents: 0 }]);
    };

    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("next/cache", () => ({
      unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
    }));

    const { getOverviewMetrics } = await import("@/lib/admin/metrics");
    const m = await getOverviewMetrics();
    expect(m.conversion30d).toBeNull();
  });
});
