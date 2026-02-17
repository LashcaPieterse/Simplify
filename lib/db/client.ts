import { PrismaClient } from '@prisma/client';

type GlobalPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalPrisma;

function resolvePrismaDatasourceUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    const isPostgres = url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    if (!isPostgres) {
      return rawUrl;
    }

    const connectionLimit =
      process.env.PRISMA_CONNECTION_LIMIT ?? (process.env.NODE_ENV === 'production' ? '1' : undefined);
    if (connectionLimit) {
      url.searchParams.set('connection_limit', connectionLimit);
    }

    const poolTimeout = process.env.PRISMA_POOL_TIMEOUT ?? '20';
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', poolTimeout);
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

const prismaDatasourceUrl = resolvePrismaDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(prismaDatasourceUrl ? { datasources: { db: { url: prismaDatasourceUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
