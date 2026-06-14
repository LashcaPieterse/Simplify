import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";

import {
  findActivePackageByIdentifier,
  findPackageDisplayByIdentifier,
} from "./package-resolver";

type TestPackage = {
  id: string;
  airaloPackageId: string;
  type: string;
  title: string;
  shortInfo: string | null;
  state: {
    isActive: boolean;
    sellingPriceCents: number | null;
    currencyCode: string;
  } | null;
  operator: {
    country: {
      countryCode: string;
      slug: string;
      title: string;
    };
  };
};

class FakePackageResolverDb {
  constructor(readonly packages: TestPackage[]) {}

  readonly package = {
    findFirst: async ({ where }: { where: unknown }) => {
      const serializedWhere = JSON.stringify(where);
      const identifier = findIdentifier(where);
      const wantsSim = serializedWhere.includes('"type":"sim"');
      const wantsTopup = serializedWhere.includes('"type":"topup"');
      const wantsActive = serializedWhere.includes('"isActive":true');
      const wantsSellingPrice = serializedWhere.includes('"sellingPriceCents"');
      const wantsAfricaScope =
        serializedWhere.includes('"countryCode":{"in"') ||
        serializedWhere.includes('"slug":{"in"');

      return (
        this.packages.find((pkg) => {
          if (identifier && pkg.id !== identifier && pkg.airaloPackageId !== identifier) {
            return false;
          }
          if (wantsSim && pkg.type !== "sim") {
            return false;
          }
          if (wantsTopup && pkg.type !== "topup") {
            return false;
          }
          if (wantsActive && pkg.state?.isActive !== true) {
            return false;
          }
          if (wantsSellingPrice && typeof pkg.state?.sellingPriceCents !== "number") {
            return false;
          }
          if (wantsAfricaScope && !["KE", "UG"].includes(pkg.operator.country.countryCode)) {
            return false;
          }
          return true;
        }) ?? null
      );
    },
  };
}

function findIdentifier(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("id" in value && typeof value.id === "string") {
    return value.id;
  }

  if ("airaloPackageId" in value && typeof value.airaloPackageId === "string") {
    return value.airaloPackageId;
  }

  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = findIdentifier(item);
        if (found) return found;
      }
    } else {
      const found = findIdentifier(nested);
      if (found) return found;
    }
  }

  return null;
}

function makePackage(overrides: Partial<TestPackage> = {}): TestPackage {
  return {
    id: "package-1",
    airaloPackageId: "ke-1gb-7d",
    type: "sim",
    title: "Kenya 1GB",
    shortInfo: null,
    state: {
      isActive: true,
      sellingPriceCents: 800,
      currencyCode: "USD",
    },
    operator: {
      country: {
        countryCode: "KE",
        slug: "kenya",
        title: "Kenya",
      },
    },
    ...overrides,
  };
}

function prisma(db: FakePackageResolverDb): PrismaClient {
  return db as unknown as PrismaClient;
}

test("purchase lookup rejects active top-up package IDs", async () => {
  const db = new FakePackageResolverDb([
    makePackage({
      id: "topup-1",
      airaloPackageId: "ke-1gb-7d-topup",
      type: "topup",
    }),
  ]);

  const pkg = await findActivePackageByIdentifier(prisma(db), "ke-1gb-7d-topup");

  assert.equal(pkg, null);
});

test("purchase lookup rejects active non-Africa package IDs", async () => {
  const db = new FakePackageResolverDb([
    makePackage({
      id: "malaysia-1",
      airaloPackageId: "my-1gb-7d",
      operator: {
        country: {
          countryCode: "MY",
          slug: "malaysia",
          title: "Malaysia",
        },
      },
    }),
  ]);

  const pkg = await findActivePackageByIdentifier(prisma(db), "my-1gb-7d");

  assert.equal(pkg, null);
});

test("top-up lookup accepts active top-up package IDs", async () => {
  const db = new FakePackageResolverDb([
    makePackage({
      id: "topup-1",
      airaloPackageId: "ke-1gb-7d-topup",
      type: "topup",
    }),
  ]);

  const pkg = await findActivePackageByIdentifier(prisma(db), "ke-1gb-7d-topup", {
    activeOnly: true,
    packageType: "topup",
    publicCatalogOnly: false,
  });

  assert.equal(pkg?.airaloPackageId, "ke-1gb-7d-topup");
});

test("display lookup can still resolve historical top-up packages", async () => {
  const db = new FakePackageResolverDb([
    makePackage({
      id: "topup-1",
      airaloPackageId: "ke-1gb-7d-topup",
      type: "topup",
    }),
  ]);

  const pkg = await findPackageDisplayByIdentifier(prisma(db), "ke-1gb-7d-topup");

  assert.equal(pkg?.airaloPackageId, "ke-1gb-7d-topup");
});

