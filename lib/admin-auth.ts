import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "cgs-admin-session";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function toHexDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function secureEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

export function hasAdminSecretConfigured() {
  return Boolean(process.env.CGS_ADMIN_SECRET);
}

export function getAdminSecret() {
  const adminSecret = process.env.CGS_ADMIN_SECRET;

  if (!adminSecret) {
    throw new Error(
      "CGS admin secret is missing. Set CGS_ADMIN_SECRET in the environment."
    );
  }

  return adminSecret;
}

function getAdminSessionToken(secret: string) {
  return toHexDigest(`cgs-admin-session:${secret}`);
}

export function isValidAdminSecret(input: string) {
  const secret = getAdminSecret();
  return secureEqual(`cgs-admin-secret:${input}`, `cgs-admin-secret:${secret}`);
}

export async function isAdminAuthenticated() {
  if (!hasAdminSecretConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return false;
  }

  const expectedSessionToken = getAdminSessionToken(getAdminSecret());

  return secureEqual(
    `cgs-admin-cookie:${sessionCookie}`,
    `cgs-admin-cookie:${expectedSessionToken}`
  );
}

export async function requireAdminAuthenticated() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    throw new Error("Unauthorized");
  }
}

export async function createAdminSession() {
  const cookieStore = await cookies();
  const secret = getAdminSecret();

  cookieStore.set(ADMIN_COOKIE_NAME, getAdminSessionToken(secret), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
