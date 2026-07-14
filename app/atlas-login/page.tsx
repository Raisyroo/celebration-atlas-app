import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { getAtlasConfigStatus } from "@/lib/atlas-control/config";
import "../atlas-control/control.css";

export default async function AtlasLoginPage({ searchParams }: { searchParams?: Promise<{ auth_error?: string }> }) {
  const auth = await requireAtlasAdmin();
  if (auth.ok) redirect("/atlas-control");
  const config = getAtlasConfigStatus();
  const params = await searchParams;
  return <main className="control-shell"><section className="control-hero"><p className="eyebrow">Celebration Atlas internal</p><h1>Atlas Control Desk access</h1><p>Use the private operator code once on this browser. Event package previews open without signing in.</p></section><LoginForm configured={config.hasUrl && config.hasAnonKey && config.hasAdminAllowlist} directAccessConfigured={config.hasAccessToken} authError={params?.auth_error} /><Link href="/" className="back-link">Return to public Atlas</Link></main>;
}
