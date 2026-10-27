import "server-only";
import { isIP } from "node:net";

export class ConfigurationError extends Error {
  constructor() {
    super("Service configuration is unavailable.");
  }
}
export function databaseConfig() {
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB;
  if (
    !uri ||
    !/^mongodb(?:\+srv)?:\/\//.test(uri) ||
    !name ||
    !/^[a-zA-Z0-9_-]+$/.test(name)
  )
    throw new ConfigurationError();
  if (
    (process.env.NODE_ENV !== "production" ||
      process.env.VERCEL_ENV === "preview") &&
    !/^mmm_(dev|test)(_|$)/.test(name)
  )
    throw new ConfigurationError();
  return { uri, name };
}
export function appOrigin() {
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "");
    if (url.origin !== process.env.APP_ORIGIN || url.username || url.password)
      throw new Error();
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new ConfigurationError();
  }
}
export function rateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new ConfigurationError();
  return secret;
}
export function coupleCookie() {
  // HTTP is allowed only on loopback for local development/production smoke tests.
  const secure = process.env.APP_ORIGIN?.startsWith("https://") ?? false;
  return {
    name: secure ? "__Host-couple_session" : "mmm_dev_couple_session",
    secure,
  };
}
export function networkIdentity(headers: Headers) {
  // Trust only Vercel's overwritten forwarding header on Vercel. On other hosts,
  // share a conservative global network bucket rather than trust spoofable input.
  if (process.env.VERCEL !== "1") return "local-or-untrusted-proxy";
  const ip = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return ip && isIP(ip) ? ip : "unknown";
}
