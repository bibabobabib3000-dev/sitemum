import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
});

describe("listCases (stub mode)", () => {
  it("returns empty result when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { listCases } = await import("@/lib/admin/cases");
    const r = await listCases({ status: "pending", search: null, page: 1, pageSize: 25 });
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.pendingTotal).toBe(0);
    expect(r.approvedTotal).toBe(0);
  });
});

describe("listCases (live mode)", () => {
  it("hydrates rows and totals from SQL responses", async () => {
    let call = 0;
    const sqlMock = () => {
      call += 1;
      if (call === 1) {
        return Promise.resolve([
          {
            user_id: "11111111-1111-1111-1111-111111111111",
            email: "a@b.com",
            full_name: "Alice",
            tg_username: "alice",
            locale: "uk",
            approved: false,
            submitted_at: "2025-02-01T10:00:00Z",
            approved_at: null,
            reviewer_email: null,
            body_preview: "Hello",
            has_video: true,
          },
          {
            user_id: "22222222-2222-2222-2222-222222222222",
            email: "b@b.com",
            full_name: null,
            tg_username: null,
            locale: "ru",
            approved: true,
            submitted_at: "2025-01-20T10:00:00Z",
            approved_at: "2025-01-21T10:00:00Z",
            reviewer_email: "admin@b.com",
            body_preview: "Hola",
            has_video: false,
          },
        ]);
      }
      return Promise.resolve([{ total: 12, pending_total: 7, approved_total: 5 }]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { listCases } = await import("@/lib/admin/cases");
    const r = await listCases({ status: "all", search: "alice", page: 1, pageSize: 25 });
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].fullName).toBe("Alice");
    expect(r.rows[0].submittedAt).toBeInstanceOf(Date);
    expect(r.rows[1].locale).toBe("ru");
    expect(r.rows[1].reviewerEmail).toBe("admin@b.com");
    expect(r.total).toBe(12);
    expect(r.pendingTotal).toBe(7);
    expect(r.approvedTotal).toBe(5);
  });
});

describe("getCaseDetail", () => {
  it("returns null when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { getCaseDetail } = await import("@/lib/admin/cases");
    expect(await getCaseDetail("u")).toBeNull();
  });

  it("includes body, video URL, and reviewer notes when present", async () => {
    const sqlMock = () =>
      Promise.resolve([
        {
          user_id: "11111111-1111-1111-1111-111111111111",
          email: "a@b.com",
          full_name: "Alice",
          tg_username: "alice",
          locale: "uk",
          approved: true,
          submitted_at: "2025-02-01T10:00:00Z",
          approved_at: "2025-02-02T11:00:00Z",
          reviewer_email: "admin@b.com",
          body_preview: "Hello",
          has_video: true,
          body_uk: "Hello world full body",
          video_url: "https://video.example.com/a",
          review_notes_uk: "Great work",
          reviewer_user_id: "33333333-3333-3333-3333-333333333333",
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { getCaseDetail } = await import("@/lib/admin/cases");
    const r = await getCaseDetail("11111111-1111-1111-1111-111111111111");
    expect(r).not.toBeNull();
    expect(r?.bodyUk).toBe("Hello world full body");
    expect(r?.videoUrl).toBe("https://video.example.com/a");
    expect(r?.reviewNotesUk).toBe("Great work");
    expect(r?.reviewerUserId).toBe("33333333-3333-3333-3333-333333333333");
    expect(r?.approvedAt).toBeInstanceOf(Date);
  });
});

describe("applyCaseDecision", () => {
  it("returns null when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { applyCaseDecision } = await import("@/lib/admin/cases");
    const r = await applyCaseDecision({
      userId: "u",
      decision: "approve",
      reviewerUserId: "r",
      notes: null,
    });
    expect(r).toBeNull();
  });

  it("on approve, flips approved=true and stamps approved_at", async () => {
    const sqlMock = (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      expect(text).toContain("update cases");
      return Promise.resolve([
        {
          approved: true,
          approved_at: "2025-02-02T11:00:00Z",
          review_notes_uk: "Looks good",
        },
      ]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { applyCaseDecision } = await import("@/lib/admin/cases");
    const r = await applyCaseDecision({
      userId: "11111111-1111-1111-1111-111111111111",
      decision: "approve",
      reviewerUserId: "22222222-2222-2222-2222-222222222222",
      notes: "Looks good",
    });
    expect(r).not.toBeNull();
    expect(r?.approved).toBe(true);
    expect(r?.approvedAt).toBeInstanceOf(Date);
    expect(r?.reviewNotesUk).toBe("Looks good");
  });

  it("on reject, returns approved=false with null approved_at", async () => {
    const sqlMock = () =>
      Promise.resolve([
        { approved: false, approved_at: null, review_notes_uk: "Please clarify" },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    const { applyCaseDecision } = await import("@/lib/admin/cases");
    const r = await applyCaseDecision({
      userId: "11111111-1111-1111-1111-111111111111",
      decision: "reject",
      reviewerUserId: "22222222-2222-2222-2222-222222222222",
      notes: "Please clarify",
    });
    expect(r?.approved).toBe(false);
    expect(r?.approvedAt).toBeNull();
  });
});
