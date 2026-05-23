import { z } from "zod";

import { OrderServiceError } from "./errors";
import { DEFAULT_QUANTITY, MAX_QUANTITY } from "./quantity";

export const createOrderInputSchema = z.object({
  packageId: z.string().min(1, "A package selection is required."),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number." })
    .int("Quantity must be an integer.")
    .positive("Quantity must be at least 1.")
    .max(MAX_QUANTITY, `You can order up to ${MAX_QUANTITY} eSIMs per checkout.`)
    .default(DEFAULT_QUANTITY)
    .optional(),
  customerEmail: z.string().email("Enter a valid email address.").optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export type ReservedOrderSnapshot = {
  orderId: string;
  packageId: string;
  airaloPackageId: string;
  packageTitle: string;
  quantity: number;
  totalCents: number;
  currency: string;
  customerEmail?: string | null;
};

export function assertValidReservedOrderSnapshot(
  snapshot: ReservedOrderSnapshot,
): void {
  if (
    !snapshot.orderId ||
    !snapshot.packageId ||
    !snapshot.airaloPackageId ||
    !snapshot.packageTitle ||
    !Number.isInteger(snapshot.quantity) ||
    snapshot.quantity < DEFAULT_QUANTITY ||
    snapshot.quantity > MAX_QUANTITY ||
    !Number.isInteger(snapshot.totalCents) ||
    snapshot.totalCents < 0 ||
    !snapshot.currency
  ) {
    throw new OrderServiceError("Checkout order snapshot is invalid.", 500);
  }
}
