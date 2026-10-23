import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

import { PrismaUserIdentityAdapter } from "./adapter";
import prisma from "@/lib/db/client";
import { verifyPassword } from "./password";
import { recordEmailProof, verifiedOAuthEmail } from "./ownership-proof";
import { sendEmail } from "@/lib/notifications/email";
import { enforceRates, refundRates } from "../security/rate-limit";
import { customerLoginReservation } from "../security/login-context";

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
        if (credentials.email.length > 254 || credentials.password.length < 8 || Buffer.byteLength(credentials.password, "utf8") > 72) return null;
        const failures = customerLoginReservation() ?? await enforceRates([{ scope: "login-account", identifier: credentials.email, limit: 10, windowSeconds: 900 }]);
        const user = await prisma.user.findUnique({ where: { email: credentials.email.trim().toLowerCase() } });
        if (!user || !user.passwordHash || user.passwordResetRequired || user.recoveryRequired) return null;
        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;
        await refundRates(failures);
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
            // signIn requires a verified matching claim before NextAuth links;
            // the initial JWT checks it again against the persisted user.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(APPLE_ID && APPLE_SECRET
      ? [
          AppleProvider({
            clientId: APPLE_ID,
            clientSecret: APPLE_SECRET,
            allowDangerousEmailAccountLinking: true,
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
    async signIn({ user, account, profile }) {
      // This callback also runs BEFORE an email link is sent. It must not mutate ownership.
      if (account?.provider === "google" || account?.provider === "apple") {
        return Boolean(user.email && verifiedOAuthEmail(account.provider, profile, user.email));
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user?.id && account) {
        token.sub = user.id;
        const source = account.provider;
        if ((source === "google" || source === "apple") && (!user.email || !verifiedOAuthEmail(source, profile, user.email))) {
          throw new Error("Verified provider email does not match this account.");
        }
        const proof = source === "email" || ((source === "google" || source === "apple") && user.email && verifiedOAuthEmail(source, profile, user.email));
        const persisted = proof && user.email
          ? await recordEmailProof(prisma, { userId: user.id, email: user.email, source: source as "email" | "google" | "apple", providerAccountId: account.providerAccountId })
          : await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        token.authVersion = persisted.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        const user = await prisma.user.findUnique({ where: { id: token.sub } });
        if (!user || token.authVersion !== user.authVersion) {
          session.user = undefined;
          return session;
        }
        session.user.id = user.id;
        session.user.emailProofVerified = Boolean(user.emailProofAt);
        session.user.recoveryRequired = user.recoveryRequired;
        session.user.passwordResetRequired = user.passwordResetRequired;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
