/** Same key the auth client uses in live preview (partitioned iframe). */
const BEARER_KEY = "grok-auth.bearer-token";

export function stashPreviewToken(token: unknown) {
  if (typeof token !== "string" || !token) return;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}
