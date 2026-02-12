const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

interface SendEmailResult {
  id: string | null;
  skipped: boolean;
}

function normalizeRecipients(recipients: string | string[]): string[] {
  return Array.isArray(recipients) ? recipients : [recipients];
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  from = process.env.ALERT_EMAIL_FROM ?? "alerts@simplify.africa",
}: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping email alert");
    return { id: null, skipped: true };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: normalizeRecipients(to),
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    const isUnverifiedDomain =
      response.status == 403 && payload.toLowerCase().includes("domain is not verified");

    if (isUnverifiedDomain) {
      console.warn(
        "Email alert skipped because ALERT_EMAIL_FROM domain is not verified in Resend",
      );
      return { id: null, skipped: true };
    }

    throw new Error(`Failed to send email alert: ${response.status} ${payload}`);
  }

  const body = (await response.json()) as { id?: string };
  return { id: body.id ?? null, skipped: false };
}
