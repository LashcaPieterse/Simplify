import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";

import { PrismaUserIdentityAdapter } from "./adapter";

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
