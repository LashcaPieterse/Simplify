import { compile } from "html-to-text";
import { resolveAiraloApnSettings, type AiraloApnSettings } from "../airalo/apn";

export { formatActivationPolicy as formatReceiptActivationPolicy } from "../esim/activation";

const readableText = compile({
  wordwrap: false,
  preserveNewlines: true,
  selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" },
    { selector: "script", format: "skip" },
    { selector: "style", format: "skip" },
    { selector: "h1", options: { uppercase: false } },
    { selector: "h2", options: { uppercase: false } },
    { selector: "h3", options: { uppercase: false } },
  ],
});

/** Supplier copy is text, never executable email HTML. Keep its setup details
 * while replacing consumer-store directions with our own order link. */
export function formatReceiptInstructions(value: string | null): string | null {
  if (!value?.trim()) return null;

  const text = readableText(value)
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .filter((line) => !isConsumerStoreInstruction(line))
    .join("\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}

function isConsumerStoreInstruction(line: string): boolean {
  return (
    /\btop[\s-]*up\b/i.test(line) ||
    /(?:^|[\s(/])(?:https?:\/\/)?(?:www\.)?airalo\.com(?:[/?#\s)]|$)/i.test(line) ||
    /\bairalo(?:['’]s)?\s+(?:website|app)\b/i.test(line) ||
    /\bmy\s+e[\s-]*sims\b/i.test(line)
  );
}

export function formatReceiptApn(value: string | null, deviceSettings?: AiraloApnSettings | null): string {
  const settings = resolveAiraloApnSettings(deviceSettings);
  if (settings) {
    return (["ios", "android"] as const).flatMap(platform => {
      const entry = settings[platform];
      if (!entry) return [];
      const label = platform === "ios" ? "iPhone" : "Android";
      if (entry.apn_type?.toLowerCase() === "automatic") {
        return [`${label}: APN is set automatically. Leave the APN settings unchanged.`];
      }
      return [`${label}: ${entry.apn_value
        ? formatReceiptApn(entry.apn_value)
        : "No manual APN value was supplied. Check your order's connection instructions before changing APN settings."}`];
    }).join("\n");
  }
  const apn = value?.trim();
  if (!apn || /^(?:n\/?a|none|null|not applicable|auto(?:matic)?)$/i.test(apn)) {
    return "No manual APN was supplied. Start with automatic settings and check your order's connection instructions if mobile data does not work.";
  }

  return `Enter ${apn} exactly in this eSIM's APN settings. Leave the other fields unchanged unless your order's connection instructions specify them.`;
}
