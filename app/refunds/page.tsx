import type { Metadata } from "next";

export const metadata: Metadata = { title: "Refund information", description: "Read how SIM.Africa evaluates travel eSIM refund requests.", alternates: { canonical: "/refunds" } };

export default function RefundsPage() {
  return <Policy title="Refund information" intro="eSIM products are digital and supplier fulfilment or activation can affect refund eligibility."><h2>Before requesting a refund</h2><p>Do not delete the eSIM. Contact support with the order reference, destination, device model, and a description of the issue so the delivery and usage status can be checked.</p><h2>How requests are assessed</h2><p>SIM.Africa evaluates requests using the payment record, supplier fulfilment status, installation information, activation state, usage data when available, and the circumstances reported. A purchase is not automatically refundable simply because the customer changed plans or devices.</p><h2>Technical problems</h2><p>Give support a reasonable opportunity to troubleshoot. If a valid package cannot be delivered or a confirmed supplier fault prevents use, SIM.Africa will assess the available remedy under the applicable terms and consumer law.</p><h2>Contact</h2><p>Email <a href="mailto:support@sim.africa">support@sim.africa</a>. Never include payment-card details.</p></Policy>;
}

function Policy({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <article className="prose prose-brand mx-auto max-w-3xl px-5 py-14 sm:px-6 lg:py-20"><h1>{title}</h1><p className="lead">{intro}</p>{children}<p><small>Last updated: 22 August 2026.</small></p></article>; }
