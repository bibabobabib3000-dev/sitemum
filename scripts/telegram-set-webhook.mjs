#!/usr/bin/env node
// Set, inspect, or remove the Telegram webhook for the RESOUL bot.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//     node scripts/telegram-set-webhook.mjs https://your-host.example/api/telegram/webhook
//
//   TELEGRAM_BOT_TOKEN=... node scripts/telegram-set-webhook.mjs --info
//   TELEGRAM_BOT_TOKEN=... node scripts/telegram-set-webhook.mjs --delete

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN env var is required.");
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error(
    "Usage:\n" +
      "  node scripts/telegram-set-webhook.mjs <https-webhook-url>\n" +
      "  node scripts/telegram-set-webhook.mjs --info\n" +
      "  node scripts/telegram-set-webhook.mjs --delete"
  );
  process.exit(1);
}

const base = `https://api.telegram.org/bot${token}`;

async function call(method, body) {
  const res = await fetch(`${base}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
  if (!json.ok) process.exit(1);
}

if (arg === "--delete") {
  await call("deleteWebhook", { drop_pending_updates: false });
} else if (arg === "--info") {
  await call("getWebhookInfo");
} else {
  if (!/^https:\/\//.test(arg)) {
    console.error("ERROR: webhook URL must start with https://");
    process.exit(1);
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  await call("setWebhook", {
    url: arg,
    secret_token: secret || undefined,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}
