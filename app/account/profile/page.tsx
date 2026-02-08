import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import prisma from "@/lib/db/client";
import { authOptions } from "@/lib/auth/options";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/account/profile")}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, createdAt: true },
  });

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-brand-900">Profile details</h2>
      <p className="mt-1 text-sm text-brand-600">
        Keep your contact details up to date for eSIM delivery and receipts.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Name</p>
          <p className="text-base font-semibold text-brand-900">{user?.name ?? "--"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Email</p>
          <p className="text-base font-semibold text-brand-900">{user?.email ?? "--"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Phone</p>
          <p className="text-base font-semibold text-brand-900">{user?.phone ?? "--"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Member since</p>
          <p className="text-base font-semibold text-brand-900">
            {user?.createdAt ? formatDate(user.createdAt) : "--"}
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm text-brand-600">
        Need to update your profile? Email support@simplify.africa and we will help.
      </p>
    </div>
  );
}
