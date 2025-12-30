import type { Metadata } from "next";

import { Suspense } from "react";

import { AuthPage } from "@/components/auth/AuthPage";
import type { ProviderInfo } from "@/components/auth/AuthForm";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Log in | Simplify",
  description: "Access your Simplify account to manage eSIMs, orders, and travelers.",
};

function getProviders(): ProviderInfo[] {
  return (authOptions.providers ?? []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type ?? "oauth",
  }));
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <AuthPage providers={getProviders()} mode="signin" />
    </Suspense>
  );
}
