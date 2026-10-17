import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

import { PrismaUserIdentityAdapter } from "./adapter";
import prisma from "@/lib/db/client";
import { verifyPassword } from "./password";
import { markUserEmailVerifiedAndClaimGuestOrders } from "./guest-orders";
import { sendEmail } from "@/lib/notifications/email";

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APPLE_ID = process.env.APPLE_CLIENT_ID;
const APPLE_SECRET = process.env.APPLE_CLIENT_SECRET;
const EMAIL_FROM = process.env.EMAIL_FROM;

function resendEmailProvider(from: string) {
  return {
    id: "email" as const,
    type: "email" as const,
    name: "Email" as const,
    server: { host: "api.resend.com", port: 443 },
    from,
    maxAge: 24 * 60 * 60,
    options: { from },
    async sendVerificationRequest({ identifier, url }: { identifier: string; url: string }) {
      const host = new URL(url).host;
      const result = await sendEmail({
        to: identifier,
        from,
        subject: `Sign in to SIM.Africa`,
        text: `Use this secure link to sign in to SIM.Africa:\n\n${url}\n\nThe link expires in 24 hours. If you did not request it, ignore this email.\n\nRequested for ${host}.`,
      });

      if (result.skipped) {
        throw new Error("Magic-link email delivery is not configured.");
      }
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaUserIdentityAdapter(),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    ...(GOOGLE_ID && GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: GOOGLE_ID,
            clientSecret: GOOGLE_SECRET,
          }),
        ]
      : []),
    ...(APPLE_ID && APPLE_SECRET
      ? [
          AppleProvider({
            clientId: APPLE_ID,
            clientSecret: APPLE_SECRET,
          }),
        ]
      : []),
    ...(process.env.RESEND_API_KEY && EMAIL_FROM
      ? [
          resendEmailProvider(EMAIL_FROM),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const trustedVerifiedProvider =
        account?.provider === "email" ||
        account?.provider === "google" ||
        account?.provider === "apple";

      if (trustedVerifiedProvider && user.id && user.email) {
        try {
          await markUserEmailVerifiedAndClaimGuestOrders(
            prisma,
            user.id,
            user.email,
          );
        } catch (error) {
          console.error("Failed to claim guest orders after verified sign-in", {
            userId: user.id,
            provider: account?.provider,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
