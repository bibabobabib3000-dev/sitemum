import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, isUserBanned } from "@/lib/auth/magic-link";
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

  // Ban gate: a banned user can request a magic link (the lookup is
  // intentionally opaque so we never confirm whether an email exists),
  // but exchanging it for a session is rejected here. We do NOT issue
  // the cookie and surface a stable `status=banned` to the login page.
  if (await isUserBanned(consumed.userId)) {
    return NextResponse.redirect(`${site}/${locale}/login?status=banned`, {
      status: 302,
    });
  }

  await setSession(consumed.userId);
  return NextResponse.redirect(`${site}/${locale}/dashboard`, { status: 302 });
}
