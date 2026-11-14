"use client";

import { useEffect } from "react";
import type { GoogleCallbackMessage } from "@/lib/auth/googleDirectIdentity";

/**
 * Landing page for the popup that `signInWithGoogleDirect` opens: Google
 * redirects here with the ID token in the URL fragment (never the query
 * string, so it is not sent to any server or written to an access log). This
 * page hands it to the window that opened it and closes.
 *
 * Popup-only, like `/auth/callback` — reads straight off `window.location`.
 */
export default function GoogleCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const state = params.get("state");
    const idToken = params.get("id_token");
    const error = params.get("error");

    // No `state` means nothing on the opener's side to match this against.
    if (state && window.opener) {
      const message: GoogleCallbackMessage = idToken
        ? { type: "coc-google-auth-success", state, idToken }
        : {
            type: "coc-google-auth-error",
            state,
            message: error ? `Google sign-in failed (${error}).` : "Google did not return an ID token.",
          };
      (window.opener as Window).postMessage(message, window.location.origin);
    }
    window.close();
  }, []);

  return (
    <main className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
      Finishing sign-in…
    </main>
  );
}
