"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

type AtlasLoginResponse = { ok?: boolean; code?: string; message?: string };

const FETCH_FAILURE_MESSAGE = "Could not reach the Atlas sign-in service. Please try again.";
const FALLBACK_START_MESSAGE = "Atlas server could not reach Supabase. Trying direct secure sign-in…";
const FALLBACK_SUCCESS_MESSAGE = "Check your inbox for the Atlas Control Desk sign-in link.";
const FALLBACK_FAILURE_MESSAGE = "Could not reach Supabase for secure sign-in. Please try again.";
const FALLBACK_CONFIG_MESSAGE = "Direct secure sign-in is missing public Supabase browser credentials. Ask an operator to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before rebuilding.";

async function requestBrowserMagicLink(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return { ok: false, message: FALLBACK_CONFIG_MESSAGE };

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/atlas-control` },
  });

  return error ? { ok: false, message: FALLBACK_FAILURE_MESSAGE } : { ok: true };
}

export default function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured || submitting) return;

    setSubmitting(true);
    setMessage("Sending secure sign-in link…");

    try {
      const response = await fetch("/api/atlas-auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as AtlasLoginResponse;

      if (payload.code === "supabase_unreachable") {
        setMessage(FALLBACK_START_MESSAGE);
        const fallbackResult = await requestBrowserMagicLink(email);
        setMessage(fallbackResult.ok ? FALLBACK_SUCCESS_MESSAGE : fallbackResult.message);
        return;
      }

      setMessage(payload.message || FETCH_FAILURE_MESSAGE);
    } catch {
      setMessage(FETCH_FAILURE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="control-panel login-form"><label>Email address<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@example.com" /></label><button disabled={!configured || submitting}>{submitting ? "Sending secure sign-in link…" : "Send magic link"}</button><p>{configured ? message : "Atlas sign-in configuration is needed before sign-in."}</p></form>;
}
