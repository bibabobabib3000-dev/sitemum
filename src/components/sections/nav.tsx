import { getSession } from "@/lib/auth/session";
import { SiteNavInner } from "./nav-inner";

/**
 * Server wrapper that resolves the current session and forwards a boolean to
 * the client nav so it can show a "Кабінет / Кабинет" link when the user is
 * authenticated. Kept as a server component so we don't need a client-side
 * fetch for session state.
 */
export async function SiteNav() {
  const session = await getSession();
  return <SiteNavInner hasSession={Boolean(session)} />;
}
