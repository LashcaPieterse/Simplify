export function safeReturnPath(value: unknown, fallback = "/account/esims"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\r\n]/.test(decoded)) return fallback;
  } catch { return fallback; }
  return value;
}
