import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
});

describe("notes (stub mode)", () => {
  it("returns null/[] when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const m = await import("@/lib/lessons/notes");
    expect(await m.getNote("u1", "l1")).toBeNull();
    expect(await m.upsertNote("u1", "l1", "hi")).toBeNull();
    expect(await m.listNotes("u1")).toEqual([]);
    expect(await m.isBookmarked("u1", "l1")).toBe(false);
    expect(await m.setBookmark("u1", "l1", true)).toBe(false);
    expect(await m.listBookmarks("u1")).toEqual([]);
  });
});

describe("getNote (live)", () => {
  it("maps a row into LessonNote", async () => {
    const sql = () =>
      Promise.resolve([
        {
          user_id: "u1",
          lesson_id: "l1",
          body_md: "hello",
          updated_at: "2025-02-01T10:00:00Z",
          created_at: "2025-01-30T10:00:00Z",
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { getNote } = await import("@/lib/lessons/notes");
    const note = await getNote("u1", "l1");
    expect(note).not.toBeNull();
    expect(note!.bodyMd).toBe("hello");
    expect(note!.updatedAt).toBeInstanceOf(Date);
    expect(note!.createdAt).toBeInstanceOf(Date);
  });

  it("returns null when no row matches", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    const { getNote } = await import("@/lib/lessons/notes");
    expect(await getNote("u1", "l1")).toBeNull();
  });
});

describe("upsertNote (live)", () => {
  it("inserts and returns the persisted row", async () => {
    let captured: { strings: TemplateStringsArray; values: unknown[] } | null = null;
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured = { strings, values };
      return Promise.resolve([
        {
          user_id: "u1",
          lesson_id: "l1",
          body_md: "hello world",
          updated_at: "2025-02-01T10:00:00Z",
          created_at: "2025-01-30T10:00:00Z",
        },
      ]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { upsertNote } = await import("@/lib/lessons/notes");
    const r = await upsertNote("u1", "l1", "hello world");
    expect(r).not.toBeNull();
    expect(r!.bodyMd).toBe("hello world");
    expect(captured).not.toBeNull();
    const sqlText = captured!.strings.join("?");
    expect(sqlText).toMatch(/insert into lesson_notes/);
    expect(sqlText).toMatch(/on conflict \(user_id, lesson_id\)/);
  });

  it("deletes the row when the body is whitespace-only", async () => {
    const seen: string[] = [];
    const sql = (strings: TemplateStringsArray) => {
      seen.push(strings.join("?"));
      return Promise.resolve([]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { upsertNote } = await import("@/lib/lessons/notes");
    const r = await upsertNote("u1", "l1", "   \n\n   ");
    expect(r).toBeNull();
    expect(seen[0]).toMatch(/delete from lesson_notes/);
  });

  it("truncates bodies longer than NOTE_BODY_MAX", async () => {
    let payload = "";
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join("?").includes("insert into lesson_notes")) {
        payload = String(values[2]);
      }
      return Promise.resolve([
        {
          user_id: "u1",
          lesson_id: "l1",
          body_md: payload,
          updated_at: "2025-02-01T10:00:00Z",
          created_at: "2025-01-30T10:00:00Z",
        },
      ]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { upsertNote, NOTE_BODY_MAX } = await import("@/lib/lessons/notes");
    const huge = "a".repeat(NOTE_BODY_MAX + 500);
    await upsertNote("u1", "l1", huge);
    expect(payload.length).toBe(NOTE_BODY_MAX);
  });
});

describe("setBookmark (live)", () => {
  it("inserts on desired=true and returns true", async () => {
    const seen: string[] = [];
    const sql = (strings: TemplateStringsArray) => {
      seen.push(strings.join("?"));
      return Promise.resolve([]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { setBookmark } = await import("@/lib/lessons/notes");
    const r = await setBookmark("u1", "l1", true);
    expect(r).toBe(true);
    expect(seen[0]).toMatch(/insert into lesson_bookmarks/);
    expect(seen[0]).toMatch(/on conflict \(user_id, lesson_id\) do nothing/);
  });

  it("deletes on desired=false and returns false", async () => {
    const seen: string[] = [];
    const sql = (strings: TemplateStringsArray) => {
      seen.push(strings.join("?"));
      return Promise.resolve([]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { setBookmark } = await import("@/lib/lessons/notes");
    const r = await setBookmark("u1", "l1", false);
    expect(r).toBe(false);
    expect(seen[0]).toMatch(/delete from lesson_bookmarks/);
  });
});

describe("isBookmarked (live)", () => {
  it("returns true when a row exists", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([{ "?column?": 1 }]),
    }));
    const { isBookmarked } = await import("@/lib/lessons/notes");
    expect(await isBookmarked("u1", "l1")).toBe(true);
  });

  it("returns false otherwise", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    const { isBookmarked } = await import("@/lib/lessons/notes");
    expect(await isBookmarked("u1", "l1")).toBe(false);
  });
});

describe("listNotes / listBookmarks (live)", () => {
  it("listNotes maps joined rows + dates", async () => {
    const sql = () =>
      Promise.resolve([
        {
          lesson_id: "l1",
          course_slug: "level-0",
          lesson_slug: "day-1",
          title_uk: "День 1",
          title_ru: "День 1",
          body_md: "hi",
          updated_at: "2025-02-01T10:00:00Z",
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { listNotes } = await import("@/lib/lessons/notes");
    const rows = await listNotes("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].courseSlug).toBe("level-0");
    expect(rows[0].lessonSlug).toBe("day-1");
    expect(rows[0].updatedAt).toBeInstanceOf(Date);
  });

  it("listBookmarks maps joined rows + day_offset", async () => {
    const sql = () =>
      Promise.resolve([
        {
          lesson_id: "l1",
          course_slug: "level-0",
          lesson_slug: "day-2",
          title_uk: "Тіло",
          title_ru: "Тело",
          day_offset: 1,
          created_at: "2025-02-01T10:00:00Z",
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { listBookmarks } = await import("@/lib/lessons/notes");
    const rows = await listBookmarks("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].dayOffset).toBe(1);
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });
});
