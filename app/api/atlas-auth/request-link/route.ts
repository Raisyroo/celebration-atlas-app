import { createClient } from "@supabase/supabase-js";
import { isAllowedAdminEmail } from "@/lib/atlas-control/auth";
import { getAtlasConfigStatus } from "@/lib/atlas-control/config";

type AtlasAuthErrorCode =
  | "malformed_request"
  | "email_not_authorized"
  | "atlas_auth_not_configured"
  | "auth_rate_limited"
  | "supabase_credentials_rejected"
  | "redirect_url_rejected"
  | "email_provider_unavailable"
  | "supabase_unreachable"
  | "magic_link_request_failed";

type SupabaseFailureCode = Exclude<
  AtlasAuthErrorCode,
  "malformed_request" | "email_not_authorized" | "atlas_auth_not_configured"
>;

type SafeAtlasAuthResponse =
  | { ok: true; message: string }
  | { ok: false; code: AtlasAuthErrorCode; message: string; requestId: string };

type UpstreamErrorDetails = {
  status?: number | string;
  code?: string;
  name?: string;
  message?: string;
};

const SUCCESS_MESSAGE = "Check your inbox for the Atlas Control Desk sign-in link.";
const SAFE_FAILURE_MESSAGES: Record<SupabaseFailureCode, (requestId: string) => string> = {
  auth_rate_limited: () => "Too many sign-in link requests. Please wait a few minutes and try again.",
  supabase_credentials_rejected: (requestId) => `Atlas sign-in service rejected its Supabase credentials. Reference: ${requestId}`,
  redirect_url_rejected: (requestId) => `Atlas sign-in redirect is not accepted by Supabase. Reference: ${requestId}`,
  email_provider_unavailable: (requestId) => `Supabase email sign-in is unavailable right now. Reference: ${requestId}`,
  supabase_unreachable: (requestId) => `Atlas could not reach Supabase from its server. Reference: ${requestId}`,
  magic_link_request_failed: (requestId) => `Atlas sign-in link could not be sent. Reference: ${requestId}`,
};

function json(body: SafeAtlasAuthResponse, status: number): Response {
  return Response.json(body, { status });
}

function failureJson(code: AtlasAuthErrorCode, message: string, status: number, requestId: string): Response {
  return json({ ok: false, code, message, requestId }, status);
}

function supabaseFailureJson(code: SupabaseFailureCode, status: number, requestId: string): Response {
  return failureJson(code, SAFE_FAILURE_MESSAGES[code](requestId), status, requestId);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getUpstreamErrorDetails(error: unknown): UpstreamErrorDetails {
  if (!error || typeof error !== "object") return {};
  const record = error as Record<string, unknown>;
  return {
    status: typeof record.status === "number" || typeof record.status === "string" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

function sanitizedMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|apikey|token|access_token|refresh_token|password|secret)=([^\s&]+)/gi, "$1=[redacted]")
    .slice(0, 200);
}

function statusNumber(status: UpstreamErrorDetails["status"]): number | undefined {
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function classifySupabaseFailure(details: UpstreamErrorDetails): SupabaseFailureCode {
  const status = statusNumber(details.status);
  const code = details.code?.toLowerCase() ?? "";
  const message = details.message?.toLowerCase() ?? "";
  const name = details.name?.toLowerCase() ?? "";
  const combined = `${code} ${message} ${name}`;
  const connectivityCodes = ["enotfound", "econnrefused", "etimedout", "econnreset", "eai_again"];

  if (status === 429 || combined.includes("rate limit") || combined.includes("too many")) return "auth_rate_limited";
  if (status === 401 || status === 403 || combined.includes("api key") || combined.includes("jwt") || combined.includes("credential")) return "supabase_credentials_rejected";
  if (combined.includes("redirect") || combined.includes("emailredirectto") || combined.includes("not allowed") || combined.includes("site url")) return "redirect_url_rejected";
  if (combined.includes("smtp") || combined.includes("email provider") || combined.includes("email sign-in") || combined.includes("mailer") || combined.includes("send email")) return "email_provider_unavailable";
  if (
    status === 0 ||
    name.includes("authretryablefetcherror") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    connectivityCodes.some((connectivityCode) => code.includes(connectivityCode))
  ) {
    return "supabase_unreachable";
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) return "email_provider_unavailable";
  return "magic_link_request_failed";
}

function logSupabaseFailure(requestId: string, category: SupabaseFailureCode, details: UpstreamErrorDetails): void {
  console.error("atlas_auth_magic_link_failed", {
    requestId,
    category,
    upstreamStatus: details.status,
    upstreamCode: details.code,
    upstreamName: details.name,
    upstreamMessage: sanitizedMessage(details.message),
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failureJson("malformed_request", "Enter a valid administrator email address.", 400, requestId);
  }

  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !isValidEmail(email)) {
    return failureJson("malformed_request", "Enter a valid administrator email address.", 400, requestId);
  }

  const config = getAtlasConfigStatus();
  if (!config.hasUrl || !config.hasAnonKey || !config.hasAdminAllowlist) {
    return failureJson("atlas_auth_not_configured", "Atlas sign-in is not fully configured. Contact an operator.", 503, requestId);
  }

  if (!isAllowedAdminEmail(email)) {
    return failureJson("email_not_authorized", "This email is not authorized for Atlas Control Desk sign-in.", 403, requestId);
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const emailRedirectTo = `${new URL(request.url).origin}/auth/callback?next=/atlas-control`;

  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
    if (!error) return json({ ok: true, message: SUCCESS_MESSAGE }, 200);

    const details = getUpstreamErrorDetails(error);
    const category = classifySupabaseFailure(details);
    const responseStatus = category === "auth_rate_limited" ? 429 : 502;
    logSupabaseFailure(requestId, category, details);
    return supabaseFailureJson(category, responseStatus, requestId);
  } catch (error) {
    const details = getUpstreamErrorDetails(error);
    const category: SupabaseFailureCode = "supabase_unreachable";
    logSupabaseFailure(requestId, category, details);
    return supabaseFailureJson(category, 502, requestId);
  }
}
