import { createClient } from "@supabase/supabase-js";
import { isAllowedAdminEmail } from "@/lib/atlas-control/auth";
import { getAtlasConfigStatus } from "@/lib/atlas-control/config";

type AtlasAuthErrorCode =
  | "malformed_request"
  | "email_not_authorized"
  | "atlas_auth_not_configured"
  | "auth_rate_limited"
  | "magic_link_request_failed";

type SafeAtlasAuthResponse =
  | { ok: true; message: string }
  | { ok: false; code: AtlasAuthErrorCode; message: string };

const SUCCESS_MESSAGE = "Check your inbox for the Atlas Control Desk sign-in link.";

function json(body: SafeAtlasAuthResponse, status: number): Response {
  return Response.json(body, { status });
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? (error as { status?: unknown }).status : undefined;
  return status === 429 || status === "429";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "malformed_request", message: "Enter a valid administrator email address." }, 400);
  }

  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !isValidEmail(email)) {
    return json({ ok: false, code: "malformed_request", message: "Enter a valid administrator email address." }, 400);
  }

  const config = getAtlasConfigStatus();
  if (!config.hasUrl || !config.hasAnonKey || !config.hasAdminAllowlist) {
    return json({ ok: false, code: "atlas_auth_not_configured", message: "Atlas sign-in is not fully configured. Contact an operator." }, 503);
  }

  if (!isAllowedAdminEmail(email)) {
    return json({ ok: false, code: "email_not_authorized", message: "This email is not authorized for Atlas Control Desk sign-in." }, 403);
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const emailRedirectTo = `${new URL(request.url).origin}/auth/callback?next=/atlas-control`;

  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
    if (!error) return json({ ok: true, message: SUCCESS_MESSAGE }, 200);
    if (isRateLimitError(error)) {
      return json({ ok: false, code: "auth_rate_limited", message: "Too many sign-in link requests. Please wait and try again." }, 429);
    }
    return json({ ok: false, code: "magic_link_request_failed", message: "Atlas sign-in link could not be sent. Please try again." }, 502);
  } catch {
    return json({ ok: false, code: "magic_link_request_failed", message: "Atlas sign-in link could not be sent. Please try again." }, 502);
  }
}
