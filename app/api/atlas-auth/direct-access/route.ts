import { NextResponse } from "next/server";
import {
  ATLAS_CONTROL_ACCESS_COOKIE,
  ATLAS_CONTROL_ACCESS_MAX_AGE,
  hashAccessToken,
  isValidAtlasAccessToken,
} from "@/lib/atlas-control/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";

  if (!isValidAtlasAccessToken(token)) {
    return NextResponse.json({ error: "Enter the current Atlas Control access code." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ATLAS_CONTROL_ACCESS_COOKIE, hashAccessToken(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ATLAS_CONTROL_ACCESS_MAX_AGE,
  });
  return response;
}
