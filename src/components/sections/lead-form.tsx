"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function LeadForm() {
  const t = useTranslations("form");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    // Placeholder: API endpoint will be implemented in PR #2.
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setDone(true);
  }

  return (
    <section
      id="form"
      className="border-t border-foreground/10 bg-muted/30 py-20 sm:py-28"
    >
      <Container className="max-w-2xl">
        <div className="text-center">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-foreground/70">{t("subtitle")}</p>
        </div>

        {done ? (
          <div
            role="status"
            className="mt-10 rounded-3xl border border-foreground/20 bg-background/60 p-8 text-center text-lg"
          >
            {t("success")}
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-10 grid gap-4 rounded-3xl border border-foreground/10 bg-background/60 p-6 sm:p-8"
          >
            <Field name="name" label={t("name")} type="text" required />
            <Field name="email" label={t("email")} type="email" required />
            <Field
              name="telegram"
              label={t("telegram")}
              type="text"
              placeholder="@username"
              required
            />
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <p className="text-xs text-foreground/50">{t("soon")}</p>
          </form>
        )}
      </Container>
    </section>
  );
}

function Field({
  name,
  label,
  type,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-foreground/70">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="h-12 rounded-full border border-foreground/20 bg-background px-5 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
      />
    </label>
  );
}
