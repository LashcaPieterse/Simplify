import type { Route } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { safeReturnPath } from "@/lib/auth/customer";
import { RecoveryForm } from "@/components/auth/RecoveryForm";
import { setRecoveredPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  const session = await getServerSession(authOptions);
  if (session?.user?.emailProofVerified && !session.user.recoveryRequired && !session.user.passwordResetRequired) redirect(returnTo as Route);
  return <main className="mx-auto max-w-lg space-y-6 px-5 py-14"><h1 className="text-3xl font-bold">Secure your account</h1>
    {session?.user?.emailProofVerified && session.user.passwordResetRequired ? <form action={setRecoveredPassword} className="space-y-4"><p>Your email is verified. Choose a new password to replace the previous credentials.</p><input type="hidden" name="returnTo" value={returnTo} /><label className="block">New password<input type="password" name="password" required minLength={8} maxLength={72} autoComplete="new-password" className="mt-2 block w-full rounded-xl border p-3" /></label><button className="rounded-xl bg-brand-900 px-5 py-3 text-white">Set password and sign in</button></form>
      : <><p>Verify your email before accessing account purchases. Your purchases are preserved.</p><RecoveryForm defaultEmail={session?.user?.email ?? ""} returnTo={returnTo} emailEnabled={Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} /></>}
  </main>;
}
