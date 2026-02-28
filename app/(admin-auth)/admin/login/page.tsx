import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = {
  title: "Admin Login | Simplify",
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-sand-50 px-6 py-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Simplify Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Secure dashboard access</h1>
        <p className="mt-3 text-base text-slate-600">
          Internal tools for managing eSIM packages, sync jobs, and sales performance.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
