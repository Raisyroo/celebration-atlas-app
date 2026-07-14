"use client";

import { useEffect } from "react";

const AUTH_CODE = /^[A-Za-z0-9._~-]{16,512}$/;
const TOKEN_HASH = /^[A-Za-z0-9_-]{16,1024}$/;
const OTP_TYPES = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

export default function AuthCallbackRecovery() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const callback = new URL("/auth/callback", window.location.origin);

    if (code && AUTH_CODE.test(code)) {
      callback.searchParams.set("code", code);
    } else if (tokenHash && TOKEN_HASH.test(tokenHash) && type && OTP_TYPES.has(type)) {
      callback.searchParams.set("token_hash", tokenHash);
      callback.searchParams.set("type", type);
    } else {
      return;
    }

    window.location.replace(callback.toString());
  }, []);

  return null;
}
