import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from "next-auth/adapters";
import type { ProviderType } from "next-auth/providers";

import prisma from "@/lib/db/client";

export function PrismaUserIdentityAdapter(): Adapter {
  return {
    async createUser(data: Omit<AdapterUser, "id">) {
      const user = await prisma.user.create({
        data: {
          email: data.email ?? "",
          name: data.name ?? null,
          phone: null,
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: null,
      };
    },
    async getUser(id: string) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: null,
      };
    },
    async getUserByEmail(email: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: null,
      };
    },
    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const identity = await prisma.userIdentity.findUnique({
        where: { provider_providerUserId: { provider, providerUserId: providerAccountId } },
        include: { user: true },
      });
      if (!identity || !identity.user) return null;
      return {
        id: identity.user.id,
        email: identity.user.email,
        name: identity.user.name,
        emailVerified: null,
      };
    },
    async updateUser(user: Partial<AdapterUser> & { id: string }) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.email ?? undefined,
          name: user.name ?? undefined,
        },
      });
      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        emailVerified: null,
      };
    },
    async deleteUser(id: string) {
      await prisma.user.delete({ where: { id } });
    },
    async linkAccount(account: AdapterAccount) {
      const created = await prisma.userIdentity.create({
        data: {
          userId: account.userId,
          provider: account.provider,
          providerUserId: account.providerAccountId,
          type: account.type,
          email: typeof account.email === "string" ? account.email : null,
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          idToken: account.id_token ?? null,
          scope: account.scope ?? null,
          tokenType: account.token_type ?? null,
          sessionState: account.session_state ?? null,
        },
      });
      const adapterAccount: AdapterAccount = {
        id: created.id,
        userId: created.userId,
        type: created.type as ProviderType,
        provider: created.provider,
        providerAccountId: created.providerUserId,
        refresh_token: created.refreshToken ?? undefined,
        access_token: created.accessToken ?? undefined,
        expires_at: created.expiresAt ?? undefined,
        token_type: created.tokenType ?? undefined,
        scope: created.scope ?? undefined,
        id_token: created.idToken ?? undefined,
        session_state: created.sessionState ?? undefined,
      };
      return adapterAccount;
    },
    async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      await prisma.userIdentity.delete({
        where: { provider_providerUserId: { provider, providerUserId: providerAccountId } },
      });
    },
    async createVerificationToken(token: VerificationToken) {
      return prisma.verificationToken.create({ data: token });
    },
    async useVerificationToken(params: { identifier: string; token: string }) {
      const existing = await prisma.verificationToken.findUnique({
        where: {
          identifier_token: { identifier: params.identifier, token: params.token },
        },
      });
      if (!existing) {
        return null;
      }
      await prisma.verificationToken.delete({
        where: {
          identifier_token: { identifier: params.identifier, token: params.token },
        },
      });
      return existing;
    },
    async getSessionAndUser() {
      // JWT strategy used; no session store.
      return null;
    },
    async createSession() {
      return null as never;
    },
    async updateSession() {
      return null as never;
    },
    async deleteSession() {
      return;
    },
  };
}
