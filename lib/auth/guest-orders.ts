import { Prisma, type PrismaClient } from "@prisma/client";

import { normalizeEmailAddress } from "@/lib/payments/checkout-request";

export type GuestOrderClaimResult = {
  orders: number;
  checkouts: number;
  payments: number;
  skipped?: "missing_email" | "user_not_verified" | "user_email_mismatch";
};

function emailFilter(email: string) {
  return {
    equals: email,
    mode: Prisma.QueryMode.insensitive,
  } as const;
}

export async function claimGuestOrdersForVerifiedEmail(
  db: PrismaClient,
  userId: string,
  email: string | null | undefined,
): Promise<GuestOrderClaimResult> {
  const normalizedEmail = email ? normalizeEmailAddress(email) : "";

  if (!normalizedEmail) {
    return { orders: 0, checkouts: 0, payments: 0, skipped: "missing_email" };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });

  if (!user?.emailVerifiedAt) {
    return {
      orders: 0,
      checkouts: 0,
      payments: 0,
      skipped: "user_not_verified",
    };
  }

  if (normalizeEmailAddress(user.email) !== normalizedEmail) {
    return {
      orders: 0,
      checkouts: 0,
      payments: 0,
      skipped: "user_email_mismatch",
    };
  }

  return db.$transaction(async (tx) => {
    const matchEmail = emailFilter(normalizedEmail);

    const orders = await tx.esimOrder.updateMany({
      where: {
        userId: null,
        customerEmail: matchEmail,
      },
      data: { userId },
    });

    const checkouts = await tx.checkoutSession.updateMany({
      where: {
        userId: null,
        customerEmail: matchEmail,
      },
      data: { userId },
    });

    const payments = await tx.paymentTransaction.updateMany({
      where: {
        userId: null,
        OR: [
          {
            checkout: {
              is: {
                userId,
                customerEmail: matchEmail,
              },
            },
          },
          {
            orders: {
              some: {
                userId,
                customerEmail: matchEmail,
              },
            },
          },
        ],
      },
      data: { userId },
    });

    return {
      orders: orders.count,
      checkouts: checkouts.count,
      payments: payments.count,
    };
  });
}

export async function markUserEmailVerifiedAndClaimGuestOrders(
  db: PrismaClient,
  userId: string,
  email: string | null | undefined,
): Promise<GuestOrderClaimResult> {
  const normalizedEmail = email ? normalizeEmailAddress(email) : "";

  if (!normalizedEmail) {
    return { orders: 0, checkouts: 0, payments: 0, skipped: "missing_email" };
  }

  const verifiedAt = new Date();
  const updated = await db.user.updateMany({
    where: {
      id: userId,
      email: emailFilter(normalizedEmail),
    },
    data: {
      emailVerifiedAt: verifiedAt,
    },
  });

  if (updated.count === 0) {
    return {
      orders: 0,
      checkouts: 0,
      payments: 0,
      skipped: "user_email_mismatch",
    };
  }

  return claimGuestOrdersForVerifiedEmail(db, userId, normalizedEmail);
}
