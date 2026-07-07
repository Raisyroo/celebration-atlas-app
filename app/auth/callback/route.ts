import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const allowedOtpTypes = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/atlas-control";
  const response = NextResponse.redirect(new URL(next, url.origin));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.headers.get("cookie")?.split(/; */).filter(Boolean).map((cookie) => { const [name, ...parts] = cookie.split("="); return { name, value: parts.join("=") }; }) ?? [],
      setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type && allowedOtpTypes.has(type)) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" });
  }
  return response;
}
