import type { NextRequest } from "next/server";
import { refreshAtlasSession } from "@/lib/atlas-control/session";

export async function proxy(request: NextRequest) {
  return refreshAtlasSession(request);
}

export const config = {
  matcher: ["/atlas-control/:path*", "/api/atlas-control/:path*"],
};
