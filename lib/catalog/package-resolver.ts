import { Prisma, type PrismaClient } from "@prisma/client";

export type PackageResolverDb = PrismaClient | Prisma.TransactionClient;

export const PACKAGE_PRICE_INCLUDE = {
  state: true,
} as const satisfies Prisma.PackageInclude;

export const PACKAGE_DISPLAY_INCLUDE = {
  operator: {
    include: {
      country: true,
    },
  },
} as const satisfies Prisma.PackageInclude;

export type PackageWithPrice = Prisma.PackageGetPayload<{
  include: typeof PACKAGE_PRICE_INCLUDE;
}>;

export type PackageDisplay = Prisma.PackageGetPayload<{
  include: typeof PACKAGE_DISPLAY_INCLUDE;
}>;

export type PackagePrice = {
  sellingPriceCents: number;
  currencyCode: string;
};

export type PackageLookupDiagnostics = {
  foundById: boolean;
  foundByExternalId: boolean;
  isActiveById: boolean | null;
  isActiveByExternalId: boolean | null;
};

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function buildPackageIdentifierWhere(
  identifier: string,
  options: { activeOnly?: boolean } = {},
): Prisma.PackageWhereInput {
  const identifierWhere: Prisma.PackageWhereInput = isUuid(identifier)
    ? { OR: [{ id: identifier }, { airaloPackageId: identifier }] }
    : { airaloPackageId: identifier };

  if (!options.activeOnly) {
    return identifierWhere;
  }

  return {
    ...identifierWhere,
    state: { is: { isActive: true } },
  };
}

export async function findActivePackageByIdentifier(
  db: PackageResolverDb,
  identifier: string,
): Promise<PackageWithPrice | null> {
  return db.package.findFirst({
    where: buildPackageIdentifierWhere(identifier, { activeOnly: true }),
    include: PACKAGE_PRICE_INCLUDE,
  });
}

export async function findPackageDisplayByIdentifier(
  db: PackageResolverDb,
  identifier: string,
): Promise<PackageDisplay | null> {
  return db.package.findFirst({
    where: buildPackageIdentifierWhere(identifier),
    include: PACKAGE_DISPLAY_INCLUDE,
  });
}

export function getPackagePrice(pkg: PackageWithPrice): PackagePrice | null {
  if (typeof pkg.state?.sellingPriceCents !== "number") {
    return null;
  }

  return {
    sellingPriceCents: pkg.state.sellingPriceCents,
    currencyCode: pkg.state.currencyCode ?? "USD",
  };
}

export async function inspectPackageIdentifierLookup(
  db: PackageResolverDb,
  identifier: string,
): Promise<PackageLookupDiagnostics> {
  const [byId, byExternalId] = await Promise.all([
    isUuid(identifier)
      ? db.package.findFirst({
          where: { id: identifier },
          include: PACKAGE_PRICE_INCLUDE,
        })
      : Promise.resolve(null),
    db.package.findFirst({
      where: { airaloPackageId: identifier },
      include: PACKAGE_PRICE_INCLUDE,
    }),
  ]);

  return {
    foundById: Boolean(byId),
    foundByExternalId: Boolean(byExternalId),
    isActiveById: byId?.state?.isActive ?? null,
    isActiveByExternalId: byExternalId?.state?.isActive ?? null,
  };
}
