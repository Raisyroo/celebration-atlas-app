import type { NextRequest } from "next/server";
import { isAllowedAdminEmail } from "@/lib/atlas-control/auth";
import { getAtlasConfigStatus, getAtlasSupabaseUrl } from "@/lib/atlas-control/config";

type AtlasAuthErrorCode =
  | "malformed_request"
  | "email_not_authorized"
  | "atlas_auth_not_configured";

type SafeAtlasAuthResponse =
  | { ok: true; message: string }
  | { ok: false; code: AtlasAuthErrorCode; message: string; requestId: string };

const APPROVED_MESSAGE = "Administrator email approved. Continue with browser Supabase sign-in.";

function json(body: SafeAtlasAuthResponse, status: number): Response {
  return Response.json(body, { status });
}

function failureJson(code: AtlasAuthErrorCode, message: string, status: number, requestId: string): Response {
  return json({ ok: false, code, message, requestId }, status);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failureJson("malformed_request", "Enter a valid administrator email address.", 400, requestId);
  }

  const email =
    typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  if (!email || !isValidEmail(email)) {
    return failureJson("malformed_request", "Enter a valid administrator email address.", 400, requestId);
  }

  const config = getAtlasConfigStatus();
  const supabaseUrl = getAtlasSupabaseUrl();
  if (!supabaseUrl || !config.hasAnonKey || !config.hasAdminAllowlist) {
    return failureJson("atlas_auth_not_configured", "Atlas sign-in is not fully configured. Contact an operator.", 503, requestId);
  }

  if (!isAllowedAdminEmail(email)) {
    return failureJson("email_not_authorized", "This email is not authorized for Atlas Control Desk sign-in.", 403, requestId);
  }

  return json({ ok: true, message: APPROVED_MESSAGE }, 200);
}
