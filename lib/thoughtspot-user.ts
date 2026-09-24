import {
  AuthenticationApi,
  createBearerAuthenticationConfig,
} from "@thoughtspot/rest-api-sdk";
import { cache } from "react";
import { getThoughtSpotAuthToken } from "@/lib/thoughtspot-auth";

const TS_HOST = process.env.NEXT_PUBLIC_TS_HOST ?? "";

export interface CurrentUser {
  displayName: string;
  /** For the "Good morning, ___." greeting on /home. */
  firstName: string;
  /** Two-letter monogram in the app header. */
  initials: string;
  email: string;
}

/**
 * Split a name into words.
 *
 * Dots, underscores and hyphens break words as well as whitespace, because
 * a ThoughtSpot `display_name` is frequently just the username — this
 * cluster returns "ronald.dugger" — and on those accounts splitting on
 * whitespace alone yields one word, so the greeting reads "Good morning,
 * ronald.dugger."
 */
function nameWords(value: string): string[] {
  return value.trim().split(/[\s._-]+/).filter(Boolean);
}

/**
 * Capitalise a word only when it is entirely lower case.
 *
 * Deliberately narrow: forcing title case would turn "McBride" into
 * "Mcbride", and a name the cluster already capitalised is a name someone
 * typed on purpose. The cost is that an all-caps account stays all-caps,
 * which is rarer than a mixed-case surname.
 */
function capitalise(word: string): string {
  return /^[a-z]/.test(word) && word === word.toLowerCase()
    ? word[0].toUpperCase() + word.slice(1)
    : word;
}

function deriveIdentity(displayName: string, email: string): CurrentUser {
  // Fall back to the local part of the email, which is usually the same
  // dotted username, before giving up on a name entirely.
  const source = nameWords(displayName).length
    ? displayName
    : (email.split("@")[0] ?? "");
  const parts = nameWords(source).map(capitalise);

  const firstName = parts[0] ?? "there";
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (firstName.slice(0, 2) || "??").toUpperCase();
  return { displayName: displayName || email, firstName, initials, email };
}

/**
 * The signed-in ThoughtSpot user. Cached per request — the header and the
 * page body both need it, and this keeps that to one round trip per render.
 *
 * Returns null when signed out or when the lookup fails; callers treat that
 * as "not signed in" rather than erroring, so a flaky cluster degrades to a
 * redirect instead of a crash.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!TS_HOST) return null;

  let authToken: string;
  try {
    authToken = await getThoughtSpotAuthToken();
  } catch {
    return null;
  }

  try {
    const client = new AuthenticationApi(
      createBearerAuthenticationConfig(TS_HOST, async () => authToken),
    );
    const user = await client.getCurrentUserInfo();
    const email = user.email || user.name || "";
    return deriveIdentity(user.display_name || user.name || email, email);
  } catch (error) {
    console.error("Failed to load the signed-in ThoughtSpot user", error);
    return null;
  }
});
