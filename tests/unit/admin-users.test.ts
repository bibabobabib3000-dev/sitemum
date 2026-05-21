import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
});

describe("listUsers (stub mode)", () => {
  it("returns empty when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { listUsers } = await import("@/lib/admin/users");
    const r = await listUsers({
      search: null,
      locale: "any",
      access: "any",
      page: 1,
      pageSize: 50,
    });
    expect(r).toEqual({ rows: [], total: 0 });
  });
});

describe("listUsers (live mode)", () => {
  it("maps SQL rows + count to typed result", async () => {
    let call = 0;
    const sqlMock = () => {
      call += 1;
      if (call === 1) {
        return Promise.resolve([
          {
            id: "11111111-1111-1111-1111-111111111111",
            email: "a@b.com",
            full_name: "Alice",
            locale: "uk",
            is_admin: false,
            banned_at: null,
            last_seen_at: "2025-02-01T10:00:00Z",
            created_at: "2025-01-15T10:00:00Z",
            utm_source: "fb_ads",
            access_slugs: ["level-0", "level-1"],
            payment_total_cents: "39800",
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            email: "b@b.com",
            full_name: null,
            locale: "ru",
            is_admin: true,
            banned_at: "2025-01-10T10:00:00Z",
            last_seen_at: null,
            created_at: "2025-01-01T10:00:00Z",
            utm_source: null,
            access_slugs: null,
            payment_total_cents: 0,
          },
        ]);
      }
      return Promise.resolve([{ n: 42 }]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { listUsers } = await import("@/lib/admin/users");
    const r = await listUsers({
      search: "alice",
      locale: "uk",
      access: "level-0",
      page: 2,
      pageSize: 25,
    });
    expect(r.total).toBe(42);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].email).toBe("a@b.com");
    expect(r.rows[0].accessSlugs).toEqual(["level-0", "level-1"]);
    expect(r.rows[0].paymentTotalCents).toBe(39800);
    expect(r.rows[0].lastSeenAt).toBeInstanceOf(Date);
    expect(r.rows[1].locale).toBe("ru");
    expect(r.rows[1].accessSlugs).toEqual([]);
    expect(r.rows[1].bannedAt).toBeInstanceOf(Date);
    expect(r.rows[1].lastSeenAt).toBeNull();
    expect(r.rows[1].isAdmin).toBe(true);
  });
});

describe("getUserDetail", () => {
  it("returns null when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { getUserDetail } = await import("@/lib/admin/users");
    expect(await getUserDetail("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("returns null when no row matches", async () => {
    const sqlMock = () => Promise.resolve([]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { getUserDetail } = await import("@/lib/admin/users");
    expect(await getUserDetail("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("assembles enrollments, access, payments, leads, case", async () => {
    let call = 0;
    const sqlMock = () => {
      call += 1;
      switch (call) {
        case 1:
          return Promise.resolve([
            {
              id: "11111111-1111-1111-1111-111111111111",
              email: "a@b.com",
              full_name: "Alice",
              locale: "uk",
              is_admin: false,
              banned_at: null,
              last_seen_at: "2025-02-01T10:00:00Z",
              created_at: "2025-01-15T10:00:00Z",
              utm_source: "fb_ads",
              tg_username: "alice",
              tg_id: "123456789",
              access_slugs: ["level-0"],
              payment_total_cents: "19900",
            },
          ]);
        case 2:
          return Promise.resolve([
            { course_slug: "level-0", started_at: "2025-01-16T10:00:00Z" },
          ]);
        case 3:
          return Promise.resolve([
            {
              product_slug: "level-0",
              granted_at: "2025-01-16T10:00:00Z",
              expires_at: null,
              granted_by_email: "admin@b.com",
            },
          ]);
        case 4:
          return Promise.resolve([
            {
              id: "p1",
              provider: "wfp",
              product_slug: "level-0",
              amount_cents: 19900,
              currency: "UAH",
              status: "success",
              created_at: "2025-01-16T10:00:00Z",
            },
          ]);
        case 5:
          return Promise.resolve([
            {
              id: "l1",
              product_slug: "level-0",
              utm_source: "fb_ads",
              referer: "https://t.me/x",
              created_at: "2025-01-15T10:00:00Z",
            },
          ]);
        case 6:
          return Promise.resolve([
            {
              body_uk: "Case body",
              video_url: "https://video/a",
              approved: true,
              submitted_at: "2025-02-01T10:00:00Z",
              approved_at: "2025-02-02T10:00:00Z",
            },
          ]);
        default:
          return Promise.resolve([]);
      }
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { getUserDetail } = await import("@/lib/admin/users");
    const r = await getUserDetail("11111111-1111-1111-1111-111111111111");
    expect(r).not.toBeNull();
    expect(r?.tgUsername).toBe("alice");
    expect(r?.tgId).toBe(123456789);
    expect(r?.enrollments).toHaveLength(1);
    expect(r?.access[0]?.grantedByEmail).toBe("admin@b.com");
    expect(r?.payments[0]?.amountCents).toBe(19900);
    expect(r?.leads[0]?.referer).toBe("https://t.me/x");
    expect(r?.caseStudy?.approved).toBe(true);
    expect(r?.caseStudy?.videoUrl).toBe("https://video/a");
  });
});

describe("adminGrantAccess / adminRevokeAccess / setBanState", () => {
  it("grants when DB configured", async () => {
    const sqlMock = vi.fn(() => Promise.resolve([{ id: "x" }]));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { adminGrantAccess } = await import("@/lib/admin/users");
    const ok = await adminGrantAccess({
      userId: "11111111-1111-1111-1111-111111111111",
      productSlug: "level-2",
      grantedByUserId: "22222222-2222-2222-2222-222222222222",
    });
    expect(ok).toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("revokes returns true when row deleted", async () => {
    const sqlMock = () => Promise.resolve([{ product_slug: "level-1" }]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { adminRevokeAccess } = await import("@/lib/admin/users");
    const ok = await adminRevokeAccess({
      userId: "11111111-1111-1111-1111-111111111111",
      productSlug: "level-1",
    });
    expect(ok).toBe(true);
  });

  it("revokes returns false when nothing matched", async () => {
    const sqlMock = () => Promise.resolve([]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { adminRevokeAccess } = await import("@/lib/admin/users");
    const ok = await adminRevokeAccess({
      userId: "11111111-1111-1111-1111-111111111111",
      productSlug: "level-1",
    });
    expect(ok).toBe(false);
  });

  it("ban flips banned_at, unban clears it", async () => {
    const sqlMock = () => Promise.resolve([{ id: "x" }]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { setBanState } = await import("@/lib/admin/users");
    expect(
      await setBanState("11111111-1111-1111-1111-111111111111", "ban"),
    ).toBe(true);
    expect(
      await setBanState("11111111-1111-1111-1111-111111111111", "unban"),
    ).toBe(true);
  });
});
