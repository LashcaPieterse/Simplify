export type AiraloApnSettings = Partial<Record<"ios" | "android", {
  apn_type: string | null;
  apn_value: string | null;
}>>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

export function resolveAiraloApnSettings(value: unknown): AiraloApnSettings | null {
  const source = record(value);
  const settings: AiraloApnSettings = {};
  for (const platform of ["ios", "android"] as const) {
    const entry = record(source?.[platform]);
    const apn_type = text(entry?.apn_type);
    const apn_value = text(entry?.apn_value);
    if (apn_type || apn_value) settings[platform] = { apn_type, apn_value };
  }
  return Object.keys(settings).length ? settings : null;
}

/** Keep legacy readers working only when a single APN value is unambiguous. */
export function resolveAiraloApnValue(value: unknown): string | null {
  if (typeof value === "string") return text(value);
  const settings = resolveAiraloApnSettings(value);
  const values = new Set(Object.values(settings ?? {}).map(entry => entry.apn_value).filter(Boolean));
  return values.size === 1 ? values.values().next().value ?? null : null;
}
