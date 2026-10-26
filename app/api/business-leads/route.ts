import { readJsonBody, BodyError } from "@/lib/http/bounded-body";
import { enforceRates, trustedClientIp, abuseResponse } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendEmail } from "@/lib/notifications/email";

const leadSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  travellersPerMonth: z.coerce.number().int().min(1).max(10000),
  countries: z.string().trim().min(2).max(500),
  message: z.string().trim().min(5).max(5000),
  website: z.string().max(0).optional().default(""),
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function POST(request: Request) {
  const recipient = process.env.BUSINESS_LEADS_EMAIL?.trim();
  if (!recipient) return NextResponse.json({ message: "Business enquiries are temporarily unavailable. Email support@sim.africa instead." }, { status: 503 });

  try {
  await enforceRates([{ scope: "business-lead", identifier: trustedClientIp(request.headers), limit: 3, windowSeconds: 3600 }]);
  const parsed = leadSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check the form fields and try again." }, { status: 422 });
  const lead = parsed.data;
  if (lead.website) return NextResponse.json({ ok: true });

  const text = [`Company: ${lead.companyName}`, `Contact: ${lead.contactName}`, `Email: ${lead.email}`, `Travellers per month: ${lead.travellersPerMonth}`, `Countries: ${lead.countries}`, "", lead.message].join("\n");
  const html = `<h1>SIM.Africa business enquiry</h1><p><strong>Company:</strong> ${escapeHtml(lead.companyName)}</p><p><strong>Contact:</strong> ${escapeHtml(lead.contactName)}</p><p><strong>Email:</strong> ${escapeHtml(lead.email)}</p><p><strong>Travellers per month:</strong> ${lead.travellersPerMonth}</p><p><strong>Countries:</strong> ${escapeHtml(lead.countries)}</p><p>${escapeHtml(lead.message).replace(/\n/g, "<br>")}</p>`;
  const result = await sendEmail({ to: recipient, subject: `Business travel enquiry — ${lead.companyName}`, text, html, from: process.env.BUSINESS_EMAIL_FROM ?? "business@sim.africa" });
  if (result.skipped) return NextResponse.json({ message: "Business enquiries are temporarily unavailable. Email support@sim.africa instead." }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return abuseResponse(error) ?? NextResponse.json({ message: error instanceof BodyError ? error.message : "Business enquiries are temporarily unavailable." }, { status: error instanceof BodyError ? error.status : 503 });
  }
}
