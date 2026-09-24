import { AuthType, init } from "@thoughtspot/visual-embed-sdk";
import { thoughtSpotCustomizations } from "@/lib/embedBranding";
import { getThoughtSpotAuthToken } from "@/lib/thoughtspot-auth";

const TS_HOST = process.env.NEXT_PUBLIC_TS_HOST ?? "";

// Side-effecting module: import it (for the side effect only) at the top of
// every embed view component.
//
// init() must run once, before any embed mounts. Calling it at module load
// time rather than inside a React effect guarantees that ordering — React
// fires a child's effects before its parent's, so an embed constructed as a
// sibling of a useInit() call can read the still-unset global config and
// throw "Error parsing ThoughtSpot host." On the server this is a no-op; the
// SDK checks for `window` and returns early.
//
// Guarded on a non-empty host for the same reason: init() throws on an empty
// string, and since every embed view imports this at module scope, an
// unguarded call takes the whole page down on hydration whenever
// NEXT_PUBLIC_TS_HOST is unset — the state a fresh clone starts in.
export const EMBED_CONFIGURED = Boolean(TS_HOST);

if (EMBED_CONFIGURED) {
  init({
    thoughtSpotHost: TS_HOST,
    authType: AuthType.TrustedAuthTokenCookieless,
    // Fetches a replacement before the current token expires, so a user
    // never lands on a signed-out embed mid-demo.
    autoLogin: true,
    // A server action: reads the httpOnly cookie minted at sign-in. The
    // secret key never reaches the browser, and neither does the mint call.
    getAuthToken: getThoughtSpotAuthToken,
    customizations: thoughtSpotCustomizations,
  });
}
