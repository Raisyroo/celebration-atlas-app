import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const allowedOtpTypes = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/atlas-control";
  return value;
}

function loginRedirect(url: URL, code: string): NextResponse {
  const redirectUrl = new URL("/atlas-login", url.origin);
  redirectUrl.searchParams.set("auth_error", code);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, url.origin));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return loginRedirect(url, "auth_not_configured");
  }

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  let authError: unknown = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    authError = result.error;
  } else if (tokenHash && type && allowedOtpTypes.has(type)) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" });
    authError = result.error;
  } else {
    return loginRedirect(url, "missing_auth_params");
  }

  if (authError) {
    console.error("atlas_auth_callback_exchange_failed", {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
    });
    return loginRedirect(url, "session_exchange_failed");
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    console.error("atlas_auth_callback_session_missing", {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
    });
    return loginRedirect(url, "session_missing");
  }

  return response;
}
