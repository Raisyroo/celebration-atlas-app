"use client";

import { useState } from "react";

const FETCH_FAILURE_MESSAGE = "Could not reach the Atlas sign-in service. Please try again.";

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
      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message || FETCH_FAILURE_MESSAGE);
    } catch {
      setMessage(FETCH_FAILURE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="control-panel login-form"><label>Email address<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@example.com" /></label><button disabled={!configured || submitting}>{submitting ? "Sending secure sign-in link…" : "Send magic link"}</button><p>{configured ? message : "Atlas sign-in configuration is needed before sign-in."}</p></form>;
}
