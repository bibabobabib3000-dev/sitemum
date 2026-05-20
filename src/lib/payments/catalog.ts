/**
 * Product catalog. Single source of truth for slugs, display names, prices.
 *
 * Prices live in **cents/копійки**. Currencies are ISO 4217. Two providers
 * are supported: WayForPay (UA, primary) and MonoPay (UA, secondary).
 */

export type ProductSlug = "level-0" | "level-1" | "level-2";

export interface Product {
  slug: ProductSlug;
  amountCents: number;
  currency: "UAH" | "USD" | "EUR";
  /** What the user sees in checkout — kept short on purpose. */
  titleUk: string;
  titleRu: string;
  descUk: string;
  descRu: string;
}

export const CATALOG: Record<ProductSlug, Product> = {
  "level-0": {
    slug: "level-0",
    amountCents: 199_00,
    currency: "UAH",
    titleUk: "Immersion Week (Level 0)",
    titleRu: "Immersion Week (Level 0)",
    descUk: "5-денний інтенсив RESOUL METHOD v1.0.",
    descRu: "5-дневный интенсив RESOUL METHOD v1.0.",
  },
  "level-1": {
    slug: "level-1",
    amountCents: 1_490_00,
    currency: "UAH",
    titleUk: "Foundation (Level 1)",
    titleRu: "Foundation (Level 1)",
    descUk: "6-тижнева програма Foundation з персональним супроводом.",
    descRu: "6-недельная программа Foundation с персональным сопровождением.",
  },
  "level-2": {
    slug: "level-2",
    amountCents: 4_900_00,
    currency: "UAH",
    titleUk: "Integration (Level 2)",
    titleRu: "Integration (Level 2)",
    descUk: "Глибока інтеграція: 12 тижнів + супервізія.",
    descRu: "Глубокая интеграция: 12 недель + супервизия.",
  },
};

export function getProduct(slug: string): Product | null {
  return (CATALOG as Record<string, Product | undefined>)[slug] ?? null;
}

export function isProductSlug(slug: string): slug is ProductSlug {
  return slug in CATALOG;
}

export function amountUah(cents: number): string {
  return (cents / 100).toFixed(2);
}
