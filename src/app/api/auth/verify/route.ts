import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { isAuthConfigured, setSession } from "@/lib/auth/session";

export const runtime = "edge";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
}

function pickLocale(sp: URLSearchParams): "uk" | "ru" {
  const v = sp.get("locale");
  return v === "ru" ? "ru" : "uk";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get("token");
  const locale = pickLocale(sp);
  const site = siteUrl();
  if (!site) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }
  if (!isAuthConfigured()) {
    return NextResponse.redirect(`${site}/${locale}/login?status=disabled`, {
      status: 302,
    });
  }
  if (!token) {
    return NextResponse.redirect(`${site}/${locale}/login?status=missing`, {
      status: 302,
    });
  }

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    return NextResponse.redirect(`${site}/${locale}/login?status=expired`, {
      status: 302,
    });
  }

  await setSession(consumed.userId);
  return NextResponse.redirect(`${site}/${locale}/dashboard`, { status: 302 });
}
