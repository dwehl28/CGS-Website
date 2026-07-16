import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "cgs-admin-session";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
const FALLBACK_ADMIN_SESSION_SECRET = "cgs-admin-session-admin";

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
  return true;
}

export function getAdminSecret() {
  return process.env.CGS_ADMIN_SECRET || FALLBACK_ADMIN_SESSION_SECRET;
}

function getAdminSessionToken(secret: string) {
  return toHexDigest(`cgs-admin-session:${secret}`);
}

function getAdminAppAccessToken(secret: string) {
  return toHexDigest(`cgs-admin-app-session:${secret}`);
}

export function isValidAdminSecret(input: string) {
  const secret = getAdminSecret();
  return secureEqual(`cgs-admin-secret:${input}`, `cgs-admin-secret:${secret}`);
}

export function isValidAdminCredentials(username: string, password: string) {
  return (
    secureEqual(
      `cgs-admin-username:${username}`,
      `cgs-admin-username:${ADMIN_USERNAME}`
    ) &&
    secureEqual(
      `cgs-admin-password:${password}`,
      `cgs-admin-password:${ADMIN_PASSWORD}`
    )
  );
}

export function createAdminAppAccessToken() {
  return getAdminAppAccessToken(getAdminSecret());
}

export function isValidAdminAppAccessToken(input: string) {
  return secureEqual(
    `cgs-admin-app-token:${input}`,
    `cgs-admin-app-token:${getAdminAppAccessToken(getAdminSecret())}`
  );
}

export async function isAdminAuthenticated() {
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
