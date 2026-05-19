import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let cached: Sql | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Sql | null {
  if (!isDbConfigured()) return null;
  if (cached) return cached;
  cached = neon(process.env.DATABASE_URL!);
  return cached;
}
