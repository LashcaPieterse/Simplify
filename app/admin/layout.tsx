import { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSession } from "@/lib/auth";

export const metadata = {
  title: "Simplify Admin",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return <AdminShell adminEmail={session.email}>{children}</AdminShell>;
}
