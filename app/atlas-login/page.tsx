import Link from "next/link";
import LoginForm from "./LoginForm";
import { getAtlasConfigStatus } from "@/lib/atlas-control/config";
import "../atlas-control/control.css";

export default function AtlasLoginPage() {
  const config = getAtlasConfigStatus();
  return <main className="control-shell"><section className="control-hero"><p className="eyebrow">Celebration Atlas internal</p><h1>Atlas Control Desk sign-in</h1><p>Use the Supabase Auth magic link for an allowlisted administrator email. The public map stays open; the control bridge stays protected.</p></section><LoginForm configured={config.hasUrl && config.hasAnonKey && config.hasAdminAllowlist} /><Link href="/" className="back-link">Return to public Atlas</Link></main>;
}
