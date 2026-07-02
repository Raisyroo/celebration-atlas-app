import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAdminEmails, getAtlasConfigStatus } from "./config";

export type AtlasAdmin = { email: string; userId: string };

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && getAdminEmails().includes(email.toLowerCase()));
}

export async function createUserSupabaseClient() {
  const status = getAtlasConfigStatus();
  if (!status.hasUrl || !status.hasAnonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
}

export async function requireAtlasAdmin(): Promise<{ ok: true; admin: AtlasAdmin } | { ok: false; status: 401 | 403 | 503; message: string }> {
  const config = getAtlasConfigStatus();
  if (!config.hasUrl || !config.hasAnonKey || !config.hasAdminAllowlist) {
    return { ok: false, status: 503, message: "Atlas Control Desk authentication is not fully configured." };
  }
  const supabase = await createUserSupabaseClient();
  const { data, error } = supabase ? await supabase.auth.getUser() : { data: { user: null }, error: null };
  if (error || !data.user?.email) return { ok: false, status: 401, message: "Sign in with an authorized Atlas administrator email." };
  if (!isAllowedAdminEmail(data.user.email)) return { ok: false, status: 403, message: "This signed-in email is not authorized for Atlas Control Desk." };
  return { ok: true, admin: { email: data.user.email, userId: data.user.id } };
}
