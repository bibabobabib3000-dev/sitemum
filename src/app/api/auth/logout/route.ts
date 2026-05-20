import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export const runtime = "edge";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
}

function pickLocale(req: NextRequest): "uk" | "ru" {
  const v = req.nextUrl.searchParams.get("locale");
  if (v === "ru") return "ru";
  return "uk";
}

async function doLogout(req: NextRequest) {
  await clearSession();
  const site = siteUrl();
  const locale = pickLocale(req);
  return NextResponse.redirect(`${site || ""}/${locale}`, { status: 302 });
}

export async function GET(req: NextRequest) {
  return doLogout(req);
}

export async function POST(req: NextRequest) {
  return doLogout(req);
}
