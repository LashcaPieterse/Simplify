import { groq } from "next-sanity";

import prisma from "@/lib/db/client";
import { getSanityClient } from "@/lib/sanity.client";

export type CatalogMismatchReason = "missing_package_ref" | "missing_in_db" | "inactive_in_db";

export type CatalogMismatch = {
  productId: string;
  productName: string;
  packageExternalId: string | null;
  packageId: string | null;
  reason: CatalogMismatchReason;
  packageUpdatedAt?: Date | null;
  packageIsActive?: boolean | null;
};

const PRODUCTS_WITH_PACKAGES_QUERY = groq`
  *[_type == "eSimProduct"]{
    _id,
    displayName,
    "packageExternalId": package->externalId,
    "packageId": package->_id
  }
`;

type SanityProductPackageRef = {
  _id: string;
  displayName: string;
  packageExternalId?: string | null;
  packageId?: string | null;
};

export async function getCatalogMismatches(): Promise<CatalogMismatch[]> {
  const client = getSanityClient();
  const products = await client.fetch<SanityProductPackageRef[]>(PRODUCTS_WITH_PACKAGES_QUERY);
  if (!products?.length) return [];

  const externalIds = Array.from(
    new Set(
      products
        .map((product) => product.packageExternalId ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const packages = externalIds.length
    ? await prisma.package.findMany({
        where: { airaloPackageId: { in: externalIds } },
        select: {
          airaloPackageId: true,
          state: { select: { isActive: true } },
          updatedAt: true,
        },
      })
    : [];

  const packageByExternalId = new Map(packages.map((pkg) => [pkg.airaloPackageId, pkg]));
  const mismatches: CatalogMismatch[] = [];

  for (const product of products) {
    const externalId = product.packageExternalId ?? null;
    if (!externalId) {
      mismatches.push({
        productId: product._id,
        productName: product.displayName,
        packageExternalId: null,
        packageId: product.packageId ?? null,
        reason: "missing_package_ref",
      });
      continue;
    }

    const pkg = packageByExternalId.get(externalId);
    if (!pkg) {
      mismatches.push({
        productId: product._id,
        productName: product.displayName,
        packageExternalId: externalId,
        packageId: product.packageId ?? null,
        reason: "missing_in_db",
      });
      continue;
    }

    if (!pkg.state?.isActive) {
      mismatches.push({
        productId: product._id,
        productName: product.displayName,
        packageExternalId: externalId,
        packageId: product.packageId ?? null,
        reason: "inactive_in_db",
        packageIsActive: pkg.state?.isActive ?? null,
        packageUpdatedAt: pkg.updatedAt,
      });
    }
  }

  return mismatches;
}
