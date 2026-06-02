/**
 * /subscription is a 308 alias for /pricing (see next.config.mjs).
 * Both routes render the exact same plan cards, driven by the
 * single source of truth in @/lib/plans. This file is the
 * fallback renderer used when the redirect is bypassed
 * (e.g. tests loading the page directly, or a host that
 * disables redirects).
 */
export { default } from "@/app/pricing/page";
