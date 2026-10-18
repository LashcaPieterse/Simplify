import Link from "next/link";

export function DeliveryHelp() {
  return (
    <section id="delivery" className="mt-16 scroll-mt-28 rounded-3xl border border-brand-100 bg-brand-50 p-6 sm:p-8">
      <h2 className="text-2xl font-black text-brand-900">Delivery and delayed orders</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-600">We request your eSIM after your payment is confirmed. Your QR code and setup guide appear on your secure order page once the supplier has provided them. Keep your checkout link so you can return to that page.</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-600">Delivery depends on the supplier; immediate availability is not guaranteed. Buy ahead of travel while you have reliable internet for installation. We send the setup details to your delivery email when available; if no email arrives, check your order page and spam folder.</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-white p-5">
          <h3 className="font-black text-brand-900">Still waiting after 10 minutes?</h3>
          <p className="mt-2 text-sm leading-6 text-brand-600">If payment is confirmed but your setup details have not appeared, email <a href="mailto:support@sim.africa" className="font-bold text-brand-700 underline underline-offset-4">support@sim.africa</a> with your order reference and payment time. If you are about to travel, contact us as soon as you notice the delay. Do not pay again for the same order.</p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-5">
          <h3 className="font-black text-brand-900">If delivery fails</h3>
          <p className="mt-2 text-sm leading-6 text-brand-600">Support checks your payment and existing supplier order to find out what happened. If the eSIM cannot be delivered, we explain the next steps and review the available remedy under our refund policy. Refunds require review; they are not issued automatically after a fixed waiting period.</p>
          <Link href="/refunds" className="mt-3 inline-block text-sm font-bold text-brand-700 underline underline-offset-4">Read the refund process</Link>
        </div>
      </div>
    </section>
  );
}
