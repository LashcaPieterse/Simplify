import { timingSafeEqual } from "node:crypto";

export function authenticateRecoveryRequest(headers: Headers, secret: string | undefined): boolean {
  const expected = secret?.trim();
  const provided = headers.get("x-airalo-sync-key");
  if (!expected || !provided) return false;
  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
