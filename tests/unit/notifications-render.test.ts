import { describe, it, expect } from "vitest";
import {
  renderEmail,
  renderTelegram,
} from "@/lib/notifications/render";

describe("renderEmail", () => {
  it("renders case.approved with uk locale", () => {
    const r = renderEmail("uk", {
      kind: "case.approved",
      dashboardUrl: "https://resoul.app/uk/dashboard",
    });
    expect(r.subject).toMatch(/RESOUL/);
    expect(r.text).toMatch(/Твій кейс схвалено/);
    expect(r.html).toContain("Відкрити кабінет");
    expect(r.html).toContain("https://resoul.app/uk/dashboard");
  });

  it("renders case.rejected with notes in ru", () => {
    const r = renderEmail("ru", {
      kind: "case.rejected",
      notes: "Добавь больше деталей",
    });
    expect(r.text).toMatch(/Ревьюер просит доработать/);
    expect(r.text).toMatch(/Добавь больше деталей/);
  });

  it("renders payment.success with amount", () => {
    const r = renderEmail("uk", {
      kind: "payment.success",
      amount: 199,
      currency: "USD",
    });
    expect(r.subject).toMatch(/199 USD/);
    expect(r.text).toMatch(/199 USD/);
  });

  it("falls back to a generic body for unknown kinds", () => {
    const r = renderEmail("uk", {
      kind: "unknown.kind",
      title: "Hi",
      body: "There",
    });
    expect(r.subject).toBe("Hi");
    expect(r.text).toBe("There");
  });

  it("escapes html-unsafe characters in body", () => {
    const r = renderEmail("uk", {
      kind: "unknown.kind",
      title: "T",
      body: "<script>alert(1)</script>",
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});

describe("renderTelegram", () => {
  it("renders compact text with dashboard url for case.approved", () => {
    const r = renderTelegram("uk", {
      kind: "case.approved",
      dashboardUrl: "https://x",
    });
    expect(r.text).toMatch(/схвалено/);
    expect(r.text).toMatch(/https:\/\/x/);
  });

  it("renders case.rejected with notes", () => {
    const r = renderTelegram("ru", {
      kind: "case.rejected",
      notes: "Нужно глубже",
    });
    expect(r.text).toMatch(/доработать/);
    expect(r.text).toMatch(/Нужно глубже/);
  });

  it("renders lesson.unlocked with title", () => {
    const r = renderTelegram("uk", {
      kind: "lesson.unlocked",
      lessonTitle: "Тіло",
    });
    expect(r.text).toMatch(/Новий урок «Тіло» відкрито/);
  });

  it("falls back to body for unknown kinds", () => {
    const r = renderTelegram("uk", { kind: "x.y", body: "abc" });
    expect(r.text).toBe("abc");
  });
});
