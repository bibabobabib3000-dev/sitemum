import { describe, it, expect, beforeEach, vi } from "vitest";

// We re-import the module under test fresh in each block so the doMock above
// it is applied. `vi.resetModules` clears the registry between blocks.

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("@/lib/auth/session");
});

describe("getAdminContext", () => {
  it("returns 'unauthenticated' when no session cookie", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => null,
    }));

    const { getAdminContext } = await import("@/lib/auth/admin");
    const result = await getAdminContext();
    expect(result.kind).toBe("unauthenticated");
  });

  it("returns 'forbidden' when DB not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }),
    }));

    const { getAdminContext } = await import("@/lib/auth/admin");
    const result = await getAdminContext();
    expect(result.kind).toBe("forbidden");
  });

  it("returns 'forbidden' for a signed-in non-admin", async () => {
    const queries: string[] = [];
    const sqlMock = (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      queries.push(text);
      // First call: lookup -> return non-admin row.
      if (text.includes("select id, email, full_name, is_admin")) {
        return Promise.resolve([
          { id: "u1", email: "u@example.com", full_name: null, is_admin: false },
        ]);
      }
      return Promise.resolve([]);
    };

    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }),
    }));

    const { getAdminContext } = await import("@/lib/auth/admin");
    const result = await getAdminContext();
    expect(result.kind).toBe("forbidden");
    // We never reach the last_seen_at update for non-admins.
    expect(queries.some((q) => q.includes("update users"))).toBe(false);
  });

  it("returns 'ok' for an admin and touches last_seen_at", async () => {
    const queries: string[] = [];
    const sqlMock = (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      queries.push(text);
      if (text.includes("select id, email, full_name, is_admin")) {
        return Promise.resolve([
          { id: "u1", email: "boss@resoul.app", full_name: "Boss", is_admin: true },
        ]);
      }
      return Promise.resolve([]);
    };

    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }),
    }));

    const { getAdminContext } = await import("@/lib/auth/admin");
    const result = await getAdminContext();
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.ctx.email).toBe("boss@resoul.app");
      expect(result.ctx.fullName).toBe("Boss");
      expect(result.ctx.userId).toBe("u1");
    }
    expect(queries.some((q) => q.includes("update users"))).toBe(true);
  });
});

describe("requireAdmin", () => {
  it("throws AdminAccessError for unauthenticated callers", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => null,
    }));

    const { requireAdmin, AdminAccessError } = await import("@/lib/auth/admin");
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessError);
    try {
      await requireAdmin();
    } catch (err) {
      expect((err as InstanceType<typeof AdminAccessError>).kind).toBe("unauthenticated");
    }
  });
});

describe("writeAuditLog", () => {
  it("no-ops when DB is unconfigured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => null,
    }));

    const { writeAuditLog } = await import("@/lib/auth/admin");
    await expect(
      writeAuditLog({ actorUserId: "u", action: "case.approve" }),
    ).resolves.toBeUndefined();
  });

  it("emits an insert when DB is configured", async () => {
    const queries: string[] = [];
    const sqlMock = (strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      return Promise.resolve([]);
    };

    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => null,
    }));

    const { writeAuditLog } = await import("@/lib/auth/admin");
    await writeAuditLog({
      actorUserId: "u1",
      action: "case.approve",
      targetType: "case",
      targetId: "u2",
      payload: { decision: "approve" },
    });
    expect(queries.some((q) => q.includes("insert into audit_log"))).toBe(true);
  });
});
