import { NextResponse } from "next/server";
import {
  ATLAS_CONTROL_ACCESS_COOKIE,
  ATLAS_CONTROL_ACCESS_MAX_AGE,
  hashAccessToken,
  isValidAtlasAccessToken,
} from "@/lib/atlas-control/auth";

function safeNextPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/atlas-control";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!isValidAtlasAccessToken(token)) {
    return NextResponse.redirect(new URL("/atlas-login?auth_error=access_denied", url.origin));
  }

  const response = NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), url.origin));
  response.cookies.set(ATLAS_CONTROL_ACCESS_COOKIE, hashAccessToken(token!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ATLAS_CONTROL_ACCESS_MAX_AGE,
  });
  return response;
}
