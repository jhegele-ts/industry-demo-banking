"use server";

import { AuthenticationApi, createBasicConfig } from "@thoughtspot/rest-api-sdk";
import { cookies } from "next/headers";
import { TS_TOKEN_COOKIE, TS_TOKEN_TTL_SECONDS } from "@/lib/thoughtspot-config";

const TS_HOST = process.env.NEXT_PUBLIC_TS_HOST ?? "";
const TS_SECRET_KEY = process.env.TS_SECRET_KEY ?? "";
const TS_ORG_ID = process.env.TS_ORG_ID ?? "";

export async function isThoughtSpotConfigured(): Promise<boolean> {
  return Boolean(TS_HOST && TS_SECRET_KEY);
}

/**
 * Mints a trusted-auth token for `email` and stores it in an httpOnly cookie.
 *
 * `auto_create: false`: the username must already exist on the cluster. Left
 * at its default of `true`, the endpoint silently provisions anyone who types
 * an address — including typos — which quietly fills the instance with junk
 * accounts. The cost is that sign-in now fails for unknown users, which the
 * error below names as the first thing to check.
 */
export async function signIn(email: string): Promise<{ error?: string }> {
  const trimmed = email.trim();
  if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { error: "Enter a valid work email" };
  }
  if (!TS_HOST || !TS_SECRET_KEY) {
    return { error: "ThoughtSpot is not configured — set NEXT_PUBLIC_TS_HOST and TS_SECRET_KEY" };
  }

  let token: string;
  try {
    const client = new AuthenticationApi(createBasicConfig(TS_HOST));
    const response = await client.getFullAccessToken({
      username: trimmed,
      email: trimmed,
      secret_key: TS_SECRET_KEY,
      ...(TS_ORG_ID ? { org_id: Number(TS_ORG_ID) } : {}),
      validity_time_in_sec: TS_TOKEN_TTL_SECONDS,
      auto_create: false,
    });
    if (!response.token) throw new Error("ThoughtSpot returned no token.");
    token = response.token;
  } catch (error) {
    console.error("Failed to generate ThoughtSpot trusted auth token", error);
    // Two very different causes land here and the browser sees neither:
    // an unknown username (now that auto_create is off), or a sleeping
    // instance returning an HTML wake-up page instead of JSON, which
    // surfaces as a parse error rather than a 4xx. Name the likely one
    // first; the server log above has the detail.
    return {
      error:
        "Could not sign in. That user may not exist on the cluster — accounts are no longer created automatically.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(TS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TS_TOKEN_TTL_SECONDS,
  });

  return {};
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TS_TOKEN_COOKIE);
}

/** Used as the Visual Embed SDK's `getAuthToken` callback, and by the
 *  Marginal chat route to authenticate against the Spotter MCP gateway. */
export async function getThoughtSpotAuthToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TS_TOKEN_COOKIE)?.value;
  if (!token) throw new Error("Not signed in to ThoughtSpot.");
  return token;
}
