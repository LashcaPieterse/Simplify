import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

import { PrismaUserIdentityAdapter } from "./adapter";
import prisma from "@/lib/db/client";
import { verifyPassword } from "./password";

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APPLE_ID = process.env.APPLE_CLIENT_ID;
const APPLE_SECRET = process.env.APPLE_CLIENT_SECRET;
const EMAIL_SERVER = process.env.EMAIL_SERVER;
const EMAIL_FROM = process.env.EMAIL_FROM;

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
    ...(EMAIL_SERVER && EMAIL_FROM
      ? [
          EmailProvider({
            server: EMAIL_SERVER,
            from: EMAIL_FROM,
          }),
        ]
      : []),
  ],
  callbacks: {
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
