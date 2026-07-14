import "server-only";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { getAdminEmails, getAtlasAnonKey, getAtlasConfigStatus, getAtlasSupabaseUrl } from "./config";

export type AtlasAdmin = { email: string; userId: string };
export const ATLAS_CONTROL_ACCESS_COOKIE = "atlas_control_access";
export const ATLAS_CONTROL_ACCESS_MAX_AGE = 60 * 60 * 24 * 180;
const DIRECT_ACCESS_IDENTITY = "direct-access@celebration-atlas.local";
const DEVELOPMENT_ACCESS_IDENTITY = "development-access@celebration-atlas.local";

export function hasLocalAtlasDevelopmentAccess(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ATLAS_REQUIRE_LOCAL_AUTH !== "true";
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && getAdminEmails().includes(email.toLowerCase()));
}

function getAccessTokenHash(): string | undefined {
  const token = process.env.ATLAS_CONTROL_ACCESS_TOKEN?.trim();
  return token ? hashAccessToken(token) : undefined;
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function isValidAtlasAccessToken(token: string | null | undefined): boolean {
  const expectedHash = getAccessTokenHash();
  if (!expectedHash || !token?.trim()) return false;
  const actualHash = hashAccessToken(token);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isValidAtlasAccessHash(hash: string | null | undefined): boolean {
  const expectedHash = getAccessTokenHash();
  if (!expectedHash || !hash) return false;
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createUserSupabaseClient() {
  const status = getAtlasConfigStatus();
  const supabaseUrl = getAtlasSupabaseUrl();
  const anonKey = getAtlasAnonKey();
  if (!status.hasUrl || !status.hasAnonKey || !supabaseUrl || !anonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The request proxy persists refreshed sessions when this runs in a Server Component.
        }
      },
    },
  });
}

export async function requireAtlasAdmin(): Promise<{ ok: true; admin: AtlasAdmin } | { ok: false; status: 401 | 403 | 503; message: string }> {
  if (hasLocalAtlasDevelopmentAccess()) {
    return { ok: true, admin: { email: DEVELOPMENT_ACCESS_IDENTITY, userId: "atlas-control-development-access" } };
  }
  const config = getAtlasConfigStatus();
  const cookieStore = await cookies();
  if (config.hasAccessToken && isValidAtlasAccessHash(cookieStore.get(ATLAS_CONTROL_ACCESS_COOKIE)?.value)) {
    return { ok: true, admin: { email: DIRECT_ACCESS_IDENTITY, userId: "atlas-control-direct-access" } };
  }
  if (!config.hasUrl || !config.hasAnonKey || !config.hasAdminAllowlist) {
    return { ok: false, status: 503, message: "Atlas Control Desk authentication is not fully configured." };
  }
  const supabase = await createUserSupabaseClient();
  const { data, error } = supabase ? await supabase.auth.getUser() : { data: { user: null }, error: null };
  if (error || !data.user?.email) return { ok: false, status: 401, message: "Sign in with an authorized Atlas administrator email." };
  if (!isAllowedAdminEmail(data.user.email)) return { ok: false, status: 403, message: "This signed-in email is not authorized for Atlas Control Desk." };
  return { ok: true, admin: { email: data.user.email, userId: data.user.id } };
}
