"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { q: string; a: string };

export function Faq() {
  const t = useTranslations("faq");
  const items = t.raw("items") as Item[];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-foreground/10 py-20 sm:py-28">
      <Container className="max-w-3xl">
        <h2 className="font-display text-4xl leading-tight sm:text-5xl">
          {t("title")}
        </h2>
        <ul className="mt-10 divide-y divide-foreground/10 border-y border-foreground/10">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-foreground"
                >
                  <span className="text-base sm:text-lg">{item.q}</span>
                  <span className="shrink-0 text-foreground/60">
                    {isOpen ? (
                      <Minus className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </span>
                </button>
                <div
                  className={cn(
                    "grid overflow-hidden transition-all duration-300",
                    isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
                  )}
                >
                  <p className="min-h-0 text-foreground/70">{item.a}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
