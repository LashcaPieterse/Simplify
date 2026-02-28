import { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSession } from "@/lib/auth";

export const metadata = {
  title: "Simplify Admin",
};

// Admin routes must always render on the server at request time since they rely on database access.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return <AdminShell adminEmail={session.email}>{children}</AdminShell>;
}
