import { createHash } from "crypto";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface MarkupRule {
  percent: number;
  fixed: number;
}

export function stableStringify(input: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }
    if (value && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = normalize((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  };

  return JSON.stringify(normalize(input));
}

export function hashNormalizedRecord(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

export function computeFieldDiff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...(before ? Object.keys(before) : []), ...Object.keys(after)]);
  for (const key of Array.from(keys)) {
    const oldValue = before?.[key];
    const newValue = after[key];
    if (stableStringify(oldValue) !== stableStringify(newValue)) {
      diff[key] = { old: oldValue, new: newValue };
    }
  }
  return diff;
}

export function applyMarkupRule(sourcePrice: number, rule: MarkupRule): number {
  const raw = sourcePrice + sourcePrice * (rule.percent / 100) + rule.fixed;
  return Math.round(raw * 10000) / 10000;
}

export function getAuditSeverity(deltaPct: number, deltaAbs: number): "low" | "medium" | "high" {
  if (deltaPct >= 8 || deltaAbs >= 2) return "high";
  if (deltaPct >= 3 || deltaAbs >= 1) return "medium";
  return "low";
}
