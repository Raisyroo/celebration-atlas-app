"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => {
    if (!configured) return null;
    return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }, [configured]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Sending secure sign-in link…");
    const origin = window.location.origin;
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=/atlas-control` } });
    setMessage(error ? "Sign-in link could not be sent. Confirm this email is authorized and Auth is configured." : "Check your inbox for the Atlas Control Desk sign-in link.");
  }
  return <form onSubmit={submit} className="control-panel login-form"><label>Email address<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@example.com" /></label><button disabled={!configured}>Send magic link</button><p>{configured ? message : "Supabase public Auth configuration is needed before sign-in."}</p></form>;
}
