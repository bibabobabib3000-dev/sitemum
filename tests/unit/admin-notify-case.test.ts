import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("@/lib/telegram/client");
  vi.doUnmock("@/lib/email/resend");
});

describe("notifyCaseDecision (no transports configured)", () => {
  it("returns not-sent statuses without throwing", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    vi.doMock("@/lib/telegram/client", () => ({
      isTelegramConfigured: () => false,
      sendMessage: vi.fn(),
    }));
    vi.doMock("@/lib/email/resend", () => ({
      isResendConfigured: () => false,
      sendEmail: vi.fn(),
    }));

    const { notifyCaseDecision } = await import("@/lib/admin/notify-case");
    const result = await notifyCaseDecision(
      { email: "a@b.com", fullName: "Alice", tgUsername: "alice", locale: "uk" },
      { decision: "approve", notes: null, dashboardUrl: "https://resoul.app/uk/dashboard" },
    );
    expect(result.email.sent).toBe(false);
    expect(result.email.error).toBe("resend_not_configured");
    expect(result.telegram.sent).toBe(false);
    expect(result.telegram.error).toBe("telegram_not_configured");
  });
});

describe("notifyCaseDecision (Resend + Telegram available)", () => {
  it("dispatches email and DM with locale-appropriate subject", async () => {
    const emailMock = vi.fn(
      async (_opts: { to: string; subject: string; html: string; text?: string }) => ({
        ok: true as const,
        id: "abc",
      }),
    );
    const sendMessageMock = vi.fn(
      async (_params: { chat_id: number | string; text: string }) => ({
        ok: true as const,
        result: undefined,
      }),
    );
    const sqlMock = (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      expect(text).toContain("select tg_chat_id from tg_users");
      return Promise.resolve([{ tg_chat_id: 99 }]);
    };

    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("@/lib/telegram/client", () => ({
      isTelegramConfigured: () => true,
      sendMessage: sendMessageMock,
    }));
    vi.doMock("@/lib/email/resend", () => ({
      isResendConfigured: () => true,
      sendEmail: emailMock,
    }));

    const { notifyCaseDecision } = await import("@/lib/admin/notify-case");
    const r = await notifyCaseDecision(
      { email: "a@b.com", fullName: "Alice", tgUsername: "alice", locale: "uk" },
      {
        decision: "reject",
        notes: "Add more detail.",
        dashboardUrl: "https://resoul.app/uk/dashboard/level-1/case-study",
      },
    );
    expect(r.email.sent).toBe(true);
    expect(r.telegram.sent).toBe(true);
    expect(emailMock).toHaveBeenCalledTimes(1);
    const emailArg = emailMock.mock.calls[0]?.[0];
    expect(emailArg?.to).toBe("a@b.com");
    expect(emailArg?.subject ?? "").toMatch(/потрібні правки/);
    expect(emailArg?.html ?? "").toContain("Add more detail.");
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    const tgArg = sendMessageMock.mock.calls[0]?.[0];
    expect(tgArg?.chat_id).toBe(99);
    expect(tgArg?.text ?? "").toContain("Alice");
    expect(tgArg?.text ?? "").toContain("Add more detail.");
  });

  it("skips Telegram when student has no DM chat on file", async () => {
    const sqlMock = () => Promise.resolve([]);
    const sendMessageMock = vi.fn();
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sqlMock,
    }));
    vi.doMock("@/lib/telegram/client", () => ({
      isTelegramConfigured: () => true,
      sendMessage: sendMessageMock,
    }));
    vi.doMock("@/lib/email/resend", () => ({
      isResendConfigured: () => false,
      sendEmail: vi.fn(),
    }));

    const { notifyCaseDecision } = await import("@/lib/admin/notify-case");
    const r = await notifyCaseDecision(
      { email: "a@b.com", fullName: null, tgUsername: "ghost", locale: "ru" },
      { decision: "approve", notes: null, dashboardUrl: "x" },
    );
    expect(r.telegram.sent).toBe(false);
    expect(r.telegram.error).toBe("no_chat_id");
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
