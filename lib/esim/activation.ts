import { compile } from "html-to-text";

const readablePolicy = compile({
  wordwrap: false,
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

export function formatActivationPolicy(
  value: string | null,
  fallback = "Check the activation policy on your secure order page before installing. Contact support if it is unclear.",
): string {
  const policy = value?.trim();
  switch (policy?.toLowerCase()) {
    case "first-usage":
      return "Your plan's validity starts when the eSIM first connects to a supported network in its coverage area. For a regional plan, this can happen in any covered country.";
    case "installation":
      return "Your plan's validity starts as soon as you install the eSIM, even if you have not reached your destination. Install it only when you are ready for the validity period to begin.";
    default: {
      const text = policy ? readablePolicy(policy).trim() : "";
      return /\s/.test(text) ? text : fallback;
    }
  }
}
