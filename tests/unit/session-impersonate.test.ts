import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Tests for the impersonation extension of `@/lib/auth/session`. We mock the
// `next/headers` cookies store in-memory so we can verify the round-trip
// without hitting Next's runtime.

interface FakeCookie {
  name: string;
  value: string;
  // Stored for inspection; we don't enforce options in these tests.
  options?: unknown;
}

let store: Map<string, FakeCookie>;

beforeEach(() => {
  store = new Map<string, FakeCookie>();
  vi.resetModules();
  process.env.AUTH_COOKIE_SECRET = "test-secret-must-be-long-enough-please";
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) => store.get(name),
      set: (name: string, value: string, options?: unknown) => {
        store.set(name, { name, value, options });
      },
    }),
  }));
});

afterEach(() => {
  vi.doUnmock("next/headers");
});

describe("enterImpersonation / getImpersonation / exitImpersonation", () => {
  it("round-trips actor + target through signed cookies", async () => {
    const session = await import("@/lib/auth/session");
    await session.enterImpersonation("admin-uid", "target-uid");

    // The session cookie now points at the target.
    const after = await session.getSession();
    expect(after?.uid).toBe("target-uid");

    // The impersonate cookie carries the actor and target uids.
    const imp = await session.getImpersonation();
    expect(imp).not.toBeNull();
    expect(imp?.actorUid).toBe("admin-uid");
    expect(imp?.targetUid).toBe("target-uid");
    expect(imp?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("exitImpersonation restores actor and clears impersonate cookie", async () => {
    const session = await import("@/lib/auth/session");
    await session.enterImpersonation("admin-uid", "target-uid");

    const exited = await session.exitImpersonation();
    expect(exited).toBe("admin-uid");

    const after = await session.getSession();
    expect(after?.uid).toBe("admin-uid");

    const imp = await session.getImpersonation();
    expect(imp).toBeNull();
  });

  it("exitImpersonation is a no-op when nothing is active", async () => {
    const session = await import("@/lib/auth/session");
    const exited = await session.exitImpersonation();
    expect(exited).toBeNull();
  });

  it("getImpersonation rejects a tampered payload", async () => {
    const session = await import("@/lib/auth/session");
    await session.enterImpersonation("admin-uid", "target-uid");

    // Mangle the signature: split at "." and rewrite the last char.
    const cur = store.get("resoul_impersonate")!.value;
    const tampered = cur.slice(0, -1) + (cur.endsWith("a") ? "b" : "a");
    store.set("resoul_impersonate", { name: "resoul_impersonate", value: tampered });

    const imp = await session.getImpersonation();
    expect(imp).toBeNull();
  });
});
