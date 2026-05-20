import { getTranslations } from "next-intl/server";
import { CATALOG } from "@/lib/payments/catalog";
import type { RecentPaymentRow } from "@/lib/auth/access-read";

interface TileHistoryProps {
  locale: "uk" | "ru";
  payments: RecentPaymentRow[];
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function formatDate(iso: string, locale: "uk" | "ru"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "uk-UA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export async function TileHistory({ locale, payments }: TileHistoryProps) {
  const t = await getTranslations({ locale, namespace: "dashboard.tiles.history" });

  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-display text-2xl">{t("title")}</h2>
      <p className="mt-2 text-sm text-foreground/65">{t("desc")}</p>

      {payments.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-foreground/15 px-4 py-6 text-sm text-foreground/55">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-2 text-sm">
          {payments.map((p, i) => {
            const product = CATALOG[p.productSlug as keyof typeof CATALOG];
            const title = product
              ? locale === "ru"
                ? product.titleRu
                : product.titleUk
              : p.productSlug;
            return (
              <li
                key={`${p.createdAt}-${i}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-background/50 px-4 py-3"
              >
                <div>
                  <p className="text-foreground">{title}</p>
                  <p className="text-xs uppercase tracking-widest text-foreground/40">
                    {formatDate(p.createdAt, locale)} · {p.provider.toUpperCase()} ·{" "}
                    {p.status}
                  </p>
                </div>
                <span className="text-sm text-foreground/80">
                  {formatAmount(p.amountCents, p.currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
