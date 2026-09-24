// Cookies are not scoped by port, so every demo served from localhost shares
// one cookie jar. Keep this name unique per demo or a sibling app's cookie
// gets replayed into this one.
export const TS_TOKEN_COOKIE = "ledgerwise_ts_token";

// Trusted-auth tokens issued at sign-in are good for a full day. The cookie's
// maxAge matches, so the session and the token expire together rather than
// leaving a valid cookie pointing at a dead token.
export const TS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
