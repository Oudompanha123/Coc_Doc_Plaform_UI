/**
 * "Continue with Google" without Keycloak in between.
 *
 * <p>For a deployment that has no Keycloak to broker Google (ADR-013 is
 * optional on the backend: with no `KEYCLOAK_ISSUER_URI` it verifies Google's
 * own ID token against `GOOGLE_CLIENT_ID` — `SessionService.verifyIdToken`).
 * The button opens a popup straight at Google's authorization endpoint and
 * asks for an ID token only (`response_type=id_token`), which Google returns
 * in the URL fragment of `/auth/google-callback`. That page posts it back
 * here; nothing is exchanged and no client secret is involved.
 *
 * <p>Same popup-and-postMessage shape as `keycloakIdentity.ts`, so the login
 * page cannot tell the two apart — see `googleSignIn.ts`, which picks one.
 *
 * <p>Two things this path gives up, both on the backend side: it does not
 * compare the token's `nonce` with the `coc_oidc_nonce` cookie, and it does
 * not carry the Google profile picture over. The nonce is still sent, so the
 * check can be added there without touching this file.
 *
 * <p>Google Cloud console, on the OAuth client whose id this uses:
 * "Authorized JavaScript origins" needs this site's origin and "Authorized
 * redirect URIs" needs `<origin>/auth/google-callback`. Neither accepts
 * wildcards, so this works on a stable domain and not on per-deploy previews.
 */

import { GoogleSignInCancelledError } from "./keycloakIdentity";
import { randomUrlSafeString } from "./pkce";

/** The same client id the Gmail consent flow uses (MailCredentialCard). */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export const isDirectGoogleSignInConfigured = Boolean(GOOGLE_CLIENT_ID);

export const GOOGLE_CALLBACK_PATH = "/auth/google-callback";
const POPUP_FEATURES = "width=500,height=650,menubar=no,toolbar=no,status=no";

export type GoogleCallbackMessage =
  | { type: "coc-google-auth-success"; state: string; idToken: string }
  | { type: "coc-google-auth-error"; state: string; message: string };

function isCallbackMessage(value: unknown): value is GoogleCallbackMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "state" in value &&
    (value.type === "coc-google-auth-success" || value.type === "coc-google-auth-error")
  );
}

/** Opens Google's own sign-in popup and resolves with the Google-issued ID token. */
export function signInWithGoogleDirect(options: { nonce: string }): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(new Error("Google Sign-In isn't configured for this environment."));
  }

  const state = randomUrlSafeString();

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", `${window.location.origin}${GOOGLE_CALLBACK_PATH}`);
  authorizeUrl.searchParams.set("response_type", "id_token");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  // Required by Google for response_type=id_token, and bound into the token.
  authorizeUrl.searchParams.set("nonce", options.nonce);
  // Always offer the account chooser, so signing out and back in can be as
  // somebody else rather than silently the same person.
  authorizeUrl.searchParams.set("prompt", "select_account");

  const openedPopup = window.open(authorizeUrl.toString(), "coc-google-signin", POPUP_FEATURES);
  if (!openedPopup) {
    return Promise.reject(
      new Error("The sign-in popup was blocked. Please allow pop-ups for this site and try again."),
    );
  }
  const popup: Window = openedPopup;

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedCheck);
    }

    function onMessage(event: MessageEvent) {
      // Same-origin only, and only for the attempt this call started.
      if (event.origin !== window.location.origin || !isCallbackMessage(event.data)) return;
      const data = event.data;
      if (data.state !== state) return;

      settled = true;
      cleanup();
      popup.close();
      if (data.type === "coc-google-auth-success") {
        resolve(data.idToken);
      } else {
        reject(new Error(data.message));
      }
    }

    window.addEventListener("message", onMessage);

    // There's no message for "the user just closed the popup" — poll for it.
    const closedCheck = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(new GoogleSignInCancelledError());
      }
    }, 500);
  });
}
