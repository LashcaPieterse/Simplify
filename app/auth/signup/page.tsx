import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/AuthPage";
import type { ProviderInfo } from "@/components/auth/AuthForm";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Create account | Simplify",
  description: "Sign up for Simplify to save your eSIM orders and activate faster.",
};

function getProviders(): ProviderInfo[] {
  return (authOptions.providers ?? []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type ?? "oauth",
  }));
}

export default function SignUpPage() {
  return <AuthPage providers={getProviders()} mode="signup" />;
}
