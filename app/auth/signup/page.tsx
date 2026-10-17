import type { Metadata } from "next";

import { Suspense } from "react";

import { AuthPage } from "@/components/auth/AuthPage";
import type { ProviderInfo } from "@/components/auth/AuthForm";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a SIM.Africa account to keep your eSIM orders together.",
  robots: { index: false, follow: false },
};

function getProviders(): ProviderInfo[] {
  return (authOptions.providers ?? []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type ?? "oauth",
  }));
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AuthPage providers={getProviders()} mode="signup" />
    </Suspense>
  );
}
