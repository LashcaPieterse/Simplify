import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      emailProofVerified?: boolean;
      recoveryRequired?: boolean;
      passwordResetRequired?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT { authVersion?: number }
}
