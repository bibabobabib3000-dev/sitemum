import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, isDbConfigured } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { leadInputSchema } from "@/lib/validation/schemas";

export const runtime = "edge";

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      422,
      "invalid_input",
      "Перевір поля форми",
      z.treeifyError(parsed.error)
    );
  }

  const input = parsed.data;
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  if (!isDbConfigured()) {
    console.log("[lead:stub]", {
      ...input,
      ip,
      userAgent,
      note: "DATABASE_URL not set — captured to stdout only",
    });
    return jsonOk({ stored: false, mode: "stub" as const });
  }

  const sql = getDb()!;

  try {
    const userRows = (await sql`
      insert into users (email, full_name, tg_username, locale,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term)
      values (${input.email}, ${input.name}, ${input.telegram},
        ${input.locale ?? "uk"},
        ${input.utm?.source ?? null}, ${input.utm?.medium ?? null},
        ${input.utm?.campaign ?? null}, ${input.utm?.content ?? null},
        ${input.utm?.term ?? null})
      on conflict (email) do update set
        full_name    = coalesce(users.full_name, excluded.full_name),
        tg_username  = coalesce(users.tg_username, excluded.tg_username),
        locale       = coalesce(users.locale, excluded.locale),
        utm_source   = coalesce(users.utm_source, excluded.utm_source),
        utm_medium   = coalesce(users.utm_medium, excluded.utm_medium),
        utm_campaign = coalesce(users.utm_campaign, excluded.utm_campaign),
        utm_content  = coalesce(users.utm_content, excluded.utm_content),
        utm_term     = coalesce(users.utm_term, excluded.utm_term)
      returning id
    `) as { id: string }[];
    const userId = userRows[0]?.id ?? null;

    await sql`
      insert into leads (user_id, email, full_name, tg_username, product_slug,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        referer, user_agent, ip)
      values (${userId}, ${input.email}, ${input.name}, ${input.telegram},
        ${input.productSlug},
        ${input.utm?.source ?? null}, ${input.utm?.medium ?? null},
        ${input.utm?.campaign ?? null}, ${input.utm?.content ?? null},
        ${input.utm?.term ?? null},
        ${input.referer ?? null}, ${userAgent}, ${ip})
    `;

    return jsonOk({ stored: true, userId, mode: "db" as const });
  } catch (err) {
    console.error("[lead:db_error]", err);
    return jsonErr(500, "db_error", "Не вдалося зберегти заявку");
  }
}
