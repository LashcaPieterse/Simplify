import { compile } from "html-to-text";

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

export function formatReceiptActivationPolicy(value: string | null): string {
  const policy = value?.trim();
  switch (policy?.toLowerCase()) {
    case "first-usage":
      return "Your plan's validity starts when the eSIM first connects to a supported network in its coverage area. For a regional plan, this can happen in any covered country.";
    case "installation":
      return "Your plan's validity starts as soon as you install the eSIM, even if you have not reached your destination. Install it only when you are ready for the validity period to begin.";
    default: {
      // Preserve descriptive supplier policies; do not guess the meaning of
      // an unknown machine label or assume first-usage activation.
      const text = policy ? readableText(policy).trim() : "";
      return /\s/.test(text)
        ? text
        : "Check the activation policy on your secure order page before installing. Contact support if it is unclear.";
    }
  }
}

export function formatReceiptApn(value: string | null): string {
  const apn = value?.trim();
  if (!apn || /^(?:n\/?a|none|null|not applicable|auto(?:matic)?)$/i.test(apn)) {
    return "No manual APN was supplied. Start with automatic settings and check your order's connection instructions if mobile data does not work.";
  }

  return `Enter ${apn} exactly in this eSIM's APN settings. Leave the other fields unchanged unless your order's connection instructions specify them.`;
}
