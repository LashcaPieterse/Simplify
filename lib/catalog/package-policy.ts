import type { Prisma } from "@prisma/client";

export const NEW_ESIM_PACKAGE_TYPE = "sim";
export const TOP_UP_PACKAGE_TYPE = "topup";

export const AFRICA_COUNTRY_CODES = [
  "DZ",
  "AO",
  "BJ",
  "BW",
  "BF",
  "BI",
  "CM",
  "CV",
  "CF",
  "TD",
  "KM",
  "CG",
  "CD",
  "CI",
  "DJ",
  "EG",
  "GQ",
  "ER",
  "SZ",
  "ET",
  "GA",
  "GM",
  "GH",
  "GN",
  "GW",
  "KE",
  "LS",
  "LR",
  "LY",
  "MG",
  "MW",
  "ML",
  "MR",
  "MU",
  "YT",
  "MA",
  "MZ",
  "NA",
  "NE",
  "NG",
  "RE",
  "RW",
  "ST",
  "SN",
  "SC",
  "SL",
  "SO",
  "ZA",
  "SS",
  "SD",
  "TZ",
  "TG",
  "TN",
  "UG",
  "ZM",
  "ZW",
] as const;

export const AFRICA_TERRITORY_SLUGS = [
  "canary-islands",
  "mayotte",
  "reunion",
] as const;

export const AFRICA_ROUTE_REGION_SLUGS = [
  "africa",
  "africa-safari",
  "middle-east-and-north-africa",
  "discover-global",
] as const;

export type PackageTypeFilter =
  | typeof NEW_ESIM_PACKAGE_TYPE
  | typeof TOP_UP_PACKAGE_TYPE
  | "any";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type PackagePolicyRecord = {
  type?: string | null;
  state?: {
    isActive?: boolean | null;
    sellingPriceCents?: number | null;
  } | null;
  operator?: {
    country?: {
      countryCode?: string | null;
      slug?: string | null;
    } | null;
  } | null;
};

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeSlug(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function andPackageWhere(
  ...wheres: Array<Prisma.PackageWhereInput | null | undefined>
): Prisma.PackageWhereInput {
  const parts = wheres.filter(
    (where): where is Prisma.PackageWhereInput =>
      Boolean(where && Object.keys(where).length > 0),
  );

  if (parts.length === 0) {
    return {};
  }

  if (parts.length === 1) {
    return parts[0]!;
  }

  return { AND: parts };
}

export function packageIdentifierWhere(identifier: string): Prisma.PackageWhereInput {
  return isUuid(identifier)
    ? { OR: [{ id: identifier }, { airaloPackageId: identifier }] }
    : { airaloPackageId: identifier };
}

export function activePackageWhere(): Prisma.PackageWhereInput {
  return { state: { is: { isActive: true } } };
}

export function packageTypeWhere(
  packageType: PackageTypeFilter | undefined,
): Prisma.PackageWhereInput {
  if (!packageType || packageType === "any") {
    return {};
  }

  return { type: packageType };
}

export function configuredSellingPriceWhere(): Prisma.PackageWhereInput {
  return { state: { is: { sellingPriceCents: { not: null } } } };
}

export function africaPackageScopeWhere(): Prisma.PackageWhereInput {
  return {
    operator: {
      is: {
        country: {
          is: {
            OR: [
              { countryCode: { in: [...AFRICA_COUNTRY_CODES] } },
              {
                slug: {
                  in: [
                    ...AFRICA_TERRITORY_SLUGS,
                    ...AFRICA_ROUTE_REGION_SLUGS,
                  ],
                },
              },
            ],
          },
        },
      },
    },
  };
}

export function publicSellablePackageWhere(
  extra?: Prisma.PackageWhereInput,
): Prisma.PackageWhereInput {
  return andPackageWhere(
    { type: NEW_ESIM_PACKAGE_TYPE },
    activePackageWhere(),
    configuredSellingPriceWhere(),
    africaPackageScopeWhere(),
    extra,
  );
}

export function topUpPackageWhere(
  extra?: Prisma.PackageWhereInput,
): Prisma.PackageWhereInput {
  return andPackageWhere(
    { type: TOP_UP_PACKAGE_TYPE },
    activePackageWhere(),
    extra,
  );
}

export function isAfricaCatalogCountry(country: {
  countryCode?: string | null;
  slug?: string | null;
}): boolean {
  const code = normalizeCode(country.countryCode);
  const slug = normalizeSlug(country.slug);

  return (
    (AFRICA_COUNTRY_CODES as readonly string[]).includes(code) ||
    (AFRICA_TERRITORY_SLUGS as readonly string[]).includes(slug) ||
    (AFRICA_ROUTE_REGION_SLUGS as readonly string[]).includes(slug)
  );
}

export function isPublicSellablePackageRecord(
  record: PackagePolicyRecord,
): boolean {
  return (
    record.type === NEW_ESIM_PACKAGE_TYPE &&
    record.state?.isActive === true &&
    typeof record.state.sellingPriceCents === "number" &&
    Number.isFinite(record.state.sellingPriceCents) &&
    Boolean(record.operator?.country && isAfricaCatalogCountry(record.operator.country))
  );
}
