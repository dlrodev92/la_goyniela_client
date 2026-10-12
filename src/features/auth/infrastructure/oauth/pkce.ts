import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const b64url = (buffer: Buffer) => buffer.toString("base64url");

export const generateState = () => b64url(randomBytes(32));
/** 43 chars of base64url, within RFC 7636's 43-128 range. */
export const generateCodeVerifier = () => b64url(randomBytes(32));
export const codeChallengeS256 = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

/** Constant-time comparison; unequal lengths or empty values never match. */
export function statesMatch(expected: string | undefined | null, received: string | undefined | null): boolean {
  if (!expected || !received) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(received).digest();
  return timingSafeEqual(a, b) && expected.length === received.length;
}

const TRANSIENT = /^([A-Za-z0-9_-]{16,128})\.([A-Za-z0-9_-]{43,128})$/;
export const encodeTransient = (state: string, verifier: string) => `${state}.${verifier}`;
export function decodeTransient(value: string | undefined): { state: string; verifier: string } | null {
  const match = value ? TRANSIENT.exec(value) : null;
  return match ? { state: match[1], verifier: match[2] } : null;
}
