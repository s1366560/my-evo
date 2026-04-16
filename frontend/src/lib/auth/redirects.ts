export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function sanitizePostAuthRedirect(
  input?: string | null,
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(input, "https://evomap.local");
    if (url.origin !== "https://evomap.local") {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function appendRedirectQuery(path: string, redirect?: string | null): string {
  const safeRedirect = sanitizePostAuthRedirect(redirect, "");
  if (!safeRedirect) return path;

  const url = new URL(path, "https://evomap.local");
  url.searchParams.set("redirect", safeRedirect);
  return `${url.pathname}${url.search}${url.hash}`;
}
