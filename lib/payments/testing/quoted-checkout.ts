import type { AiraloClient } from "../../airalo/client";
import { createCheckout, type CreateCheckoutInput } from "../checkouts";
import { createCheckoutQuote } from "../quotes";

/** Exercises the real quote flow for existing payment/accounting integration fixtures. */
export async function createQuotedCheckout(input: CreateCheckoutInput, options: Parameters<typeof createCheckout>[1]) {
  const db = options.prisma!;
  const pkg = await db.package.findUniqueOrThrow({ where: { id: input.packageId } });
  const airaloClient = { getSimTopUpPackages: async () => [{ id: pkg.airaloPackageId, price: Number(pkg.price) }] } as unknown as AiraloClient;
  const owner = { userId: options.userId, guestSessionId: options.guestSessionId ?? "integration-guest-session" };
  const quote = await createCheckoutQuote({ packageId: input.packageId, intent: input.intent, topUpForOrderId: input.topUpForOrderId }, owner, db, { airaloClient });
  return createCheckout({ ...input, quoteId: quote.id }, { ...options, ...owner, topUpAiraloClient: airaloClient });
}
