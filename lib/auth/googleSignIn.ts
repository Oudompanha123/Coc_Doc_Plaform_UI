/**
 * The one "Continue with Google" entry point the login page uses.
 *
 * <p>Two ways to get an ID token, and which one applies is a deployment fact:
 *
 * <ul>
 *   <li>Keycloak brokering Google (ADR-013) — when all three
 *       `NEXT_PUBLIC_KEYCLOAK_*` variables are set.
 *   <li>Google directly — when they are not and
 *       `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is.
 * </ul>
 *
 * <p>Keycloak wins when both are set, because the backend makes the same
 * choice the same way: with a Keycloak issuer configured it accepts only
 * Keycloak's tokens, and a Google-issued one would be refused. A developer
 * machine has both (the client id is also used for the Gmail consent flow),
 * and must keep going through Keycloak.
 */

import {
  GoogleSignInCancelledError,
  isGoogleSignInConfigured as isKeycloakConfigured,
  signInWithGoogleViaKeycloak,
} from "./keycloakIdentity";
import { isDirectGoogleSignInConfigured, signInWithGoogleDirect } from "./googleDirectIdentity";

export { GoogleSignInCancelledError };

/** True when either path can work — use to hide the Google button otherwise. */
export const isGoogleSignInConfigured = isKeycloakConfigured || isDirectGoogleSignInConfigured;

/** Resolves with the ID token to hand to `POST /api/v1/auth/google`. */
export function signInWithGoogle(options: { nonce: string }): Promise<string> {
  return isKeycloakConfigured ? signInWithGoogleViaKeycloak(options) : signInWithGoogleDirect(options);
}
