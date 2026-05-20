"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavLink =
  | { key: "method" | "program" | "about" | "faq"; href: string; external?: false }
  | { key: "platform"; href: "/platform"; external: true };

const NAV_LINKS: NavLink[] = [
  { href: "#method", key: "method" },
  { href: "#program", key: "program" },
  { href: "/platform", key: "platform", external: true },
  { href: "#about", key: "about" },
  { href: "#faq", key: "faq" },
];

export function SiteNavInner({ hasSession }: { hasSession?: boolean }) {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-foreground/10 bg-background/80 backdrop-blur"
          : "border-b border-transparent"
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-tight">
          RESOUL
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) =>
            l.external ? (
              <Link
                key={l.key}
                href={l.href}
                className="text-sm text-foreground/70 transition-colors hover:text-foreground"
              >
                {t(l.key)}
              </Link>
            ) : (
              <a
                key={l.key}
                href={l.href}
                className="text-sm text-foreground/70 transition-colors hover:text-foreground"
              >
                {t(l.key)}
              </a>
            )
          )}
          {hasSession ? (
            <Link
              href="/dashboard"
              className="text-sm text-foreground transition-colors hover:text-foreground"
            >
              {t("dashboard")}
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {hasSession ? (
            <Link
              href="/dashboard"
              className="hidden rounded-full border border-foreground/30 px-5 py-2 text-xs font-medium text-foreground transition-colors hover:border-foreground hover:bg-foreground/5 sm:inline-flex"
            >
              {t("dashboard")}
            </Link>
          ) : (
            <Link
              href="/#form"
              className="hidden rounded-full bg-foreground px-5 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/90 sm:inline-flex"
            >
              {t("cta")}
            </Link>
          )}
        </div>
      </Container>
    </header>
  );
}
