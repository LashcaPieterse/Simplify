import type { Prisma } from "@prisma/client";

import prisma from "@/lib/db/client";
import {
  AFRICA_COUNTRY_CODES,
  AFRICA_ROUTE_REGION_SLUGS,
  publicSellablePackageWhere,
} from "@/lib/catalog/package-policy";

const STOREFRONT_PACKAGE_INCLUDE = {
  state: true,
  operator: {
    include: {
      country: true,
    },
  },
} as const satisfies Prisma.PackageInclude;

type StorefrontPackageRecord = Prisma.PackageGetPayload<{
  include: typeof STOREFRONT_PACKAGE_INCLUDE;
}>;

export type StorefrontCountry = {
  id: string;
  title: string;
  slug: string;
  countryCode: string;
  image: unknown | null;
  planCount: number;
  minimumPrice: {
    amount: number;
    currency: string;
  };
};

export type CoverageDestination = {
  name: string;
  code: string | null;
  slug: string;
};

export type StorefrontPlan = {
  id: string;
  externalId: string;
  title: string;
  destination: StorefrontCountry;
  isRegional: boolean;
  dataLabel: string;
  dataAmountMb: number | null;
  isUnlimited: boolean;
  validityDays: number | null;
  price: {
    amount: number;
    cents: number;
    currency: string;
  };
  operatorName: string | null;
  networks: string[];
  networkTypes: string[];
  hotspot: boolean | null;
  callsAndSms: boolean | null;
  callsMinutes: number | null;
  texts: number | null;
  includesPhoneNumber: boolean | null;
  topUpAvailable: boolean | null;
  activationPolicy: string | null;
  installWindowDays: number | null;
  apn: string | null;
  coverage: CoverageDestination[];
  coverageVerified: boolean;
  fairUsagePolicy: string | null;
  shortInfo: string | null;
  otherInfo: string | null;
  lastSyncedAt: string | null;
};

type JsonRecord = Record<string, unknown>;

const countryNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

function countryDisplayName(name: string | null, code: string | null): string | null {
  if (name && !/^[a-z]{2}$/i.test(name)) return name;
  const region = code ?? name;
  if (region && /^[a-z]{2}$/i.test(region)) {
    return countryNames.of(region.toUpperCase()) ?? name ?? region;
  }
  return name ?? region;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readFirstString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeText(record[key]);
    if (value) return value;
  }
  return null;
}

function walkJson(value: unknown, visit: (record: JsonRecord) => void): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkJson(entry, visit));
    return;
  }

  if (!isRecord(value)) return;
  visit(value);
  Object.values(value).forEach((entry) => walkJson(entry, visit));
}

export function extractCoverageDestinations(value: unknown): CoverageDestination[] {
  const destinations = new Map<string, CoverageDestination>();

  walkJson(value, (record) => {
    const explicitCode = readFirstString(record, [
      "country_code",
      "countryCode",
      "iso2",
      "iso_code",
    ]);
    const genericCode = readFirstString(record, ["code"]);
    const code = explicitCode ?? (
      genericCode && /^[a-z]{2}$/i.test(genericCode) ? genericCode : null
    );
    const explicitName = readFirstString(record, [
      "country",
      "country_name",
      "countryName",
    ]);
    const looksLikeCoverageEntry = Boolean(
      code || explicitName || Array.isArray(record.networks),
    );
    const name = explicitName ?? (
      looksLikeCoverageEntry ? readFirstString(record, ["name", "title"]) : null
    );

    if (!code && !name) return;

    const normalizedCode = code?.toUpperCase() ?? null;
    const normalizedName = countryDisplayName(name, normalizedCode);
    if (!normalizedName) return;

    const slug = slugify(normalizedName);
    const key = normalizedCode ?? slug;
    if (!key || !slug) return;

    destinations.set(key, {
      name: normalizedName,
      code: normalizedCode,
      slug,
    });
  });

  return Array.from(destinations.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );
}

export function extractNetworkNames(value: unknown): string[] {
  const networks = new Set<string>();

  walkJson(value, (record) => {
    const name = readFirstString(record, [
      "network_name",
      "networkName",
      "carrier",
      "carrier_name",
    ]);
    if (name) networks.add(name);

    if (Array.isArray(record.networks)) {
      for (const entry of record.networks) {
        if (typeof entry === "string" && entry.trim()) {
          networks.add(entry.trim());
        } else if (isRecord(entry)) {
          const nestedName = readFirstString(entry, [
            "name",
            "title",
            "network_name",
            "networkName",
            "carrier",
            "carrier_name",
          ]);
          if (nestedName) networks.add(nestedName);
        }
      }
    }
  });

  return Array.from(networks).sort((left, right) => left.localeCompare(right));
}

export function extractNetworkTypes(value: unknown): string[] {
  const values = new Set<string>();

  const addStructuredValue = (candidate: unknown) => {
    if (typeof candidate !== "string") return;
    const normalized = candidate.trim().toUpperCase();
    if (/^(5G|4G|LTE|3G|2G)$/.test(normalized)) values.add(normalized);
  };

  walkJson(value, (record) => {
    ["network_type", "networkType", "technology"].forEach((key) =>
      addStructuredValue(record[key]),
    );
    ["types", "network_types", "technologies"].forEach((key) => {
      const candidates = record[key];
      if (Array.isArray(candidates)) candidates.forEach(addStructuredValue);
    });
  });

  return ["5G", "4G", "LTE", "3G", "2G"].filter((type) => values.has(type));
}

function extractApn(record: StorefrontPackageRecord): string | null {
  if (record.operator.apnValue?.trim()) return record.operator.apnValue.trim();
  if (!record.operator.apn) return null;

  if (typeof record.operator.apn === "string") {
    return record.operator.apn.trim() || null;
  }

  if (isRecord(record.operator.apn)) {
    return readFirstString(record.operator.apn, ["apn", "value", "name"]);
  }

  return null;
}

function formatPackageData(record: StorefrontPackageRecord): string {
  if (record.isUnlimited) return "Unlimited";
  if (record.data?.trim()) return record.data.trim();
  if (record.amount >= 1024) {
    const gb = Math.round((record.amount / 1024) * 10) / 10;
    return `${Number.isInteger(gb) ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  }
  return record.amount > 0 ? `${record.amount} MB` : "Data allowance unavailable";
}

function toCountry(record: StorefrontPackageRecord): StorefrontCountry {
  const country = record.operator.country;
  const state = record.state!;

  return {
    id: country.id,
    title: countryDisplayName(country.title, country.countryCode) ?? country.title,
    slug: country.slug,
    countryCode: country.countryCode,
    image: country.imageJson ?? null,
    planCount: 1,
    minimumPrice: {
      amount: state.sellingPriceCents! / 100,
      currency: state.currencyCode.toUpperCase(),
    },
  };
}

export function mapStorefrontPlan(record: StorefrontPackageRecord): StorefrontPlan {
  const destination = toCountry(record);
  const isRegional = (AFRICA_ROUTE_REGION_SLUGS as readonly string[]).includes(
    destination.slug,
  );
  const extractedCoverage = [
    ...extractCoverageDestinations(record.operator.countriesJson),
    ...extractCoverageDestinations(record.operator.coveragesJson),
  ];
  const coverage = new Map<string, CoverageDestination>();

  const baseDestination: CoverageDestination = {
    name: destination.title,
    code: destination.countryCode?.toUpperCase() || null,
    slug: destination.slug,
  };
  if (!isRegional) coverage.set(baseDestination.code ?? baseDestination.slug, baseDestination);
  extractedCoverage.forEach((entry) => coverage.set(entry.code ?? entry.slug, entry));

  const normalizedPlanType = record.operator.planType?.trim().toLowerCase() ?? "";
  const hasVoiceOrText =
    (typeof record.voice === "number" && record.voice > 0) ||
    (typeof record.text === "number" && record.text > 0);
  const callsAndSms = hasVoiceOrText || /voice|text|sms/.test(normalizedPlanType)
    ? true
    : normalizedPlanType === "data"
      ? false
      : null;

  return {
    id: record.id,
    externalId: record.airaloPackageId,
    title: record.title,
    destination,
    isRegional,
    dataLabel: formatPackageData(record),
    dataAmountMb: record.amount > 0 ? record.amount : null,
    isUnlimited: record.isUnlimited,
    validityDays: record.day > 0 ? record.day : null,
    price: {
      amount: record.state!.sellingPriceCents! / 100,
      cents: record.state!.sellingPriceCents!,
      currency: record.state!.currencyCode.toUpperCase(),
    },
    operatorName: record.operator.title?.trim() || null,
    networks: extractNetworkNames(record.operator.coveragesJson),
    networkTypes: extractNetworkTypes(record.operator.coveragesJson),
    hotspot: null,
    callsAndSms,
    callsMinutes: typeof record.voice === "number" && record.voice > 0 ? record.voice : null,
    texts: typeof record.text === "number" && record.text > 0 ? record.text : null,
    includesPhoneNumber: null,
    topUpAvailable: record.operator.rechargeability ?? null,
    activationPolicy: record.operator.activationPolicy?.trim() || null,
    installWindowDays: record.operator.installWindowDays,
    apn: extractApn(record),
    coverage: Array.from(coverage.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    ),
    coverageVerified: !isRegional || extractedCoverage.length > 0,
    fairUsagePolicy: record.isFairUsagePolicy
      ? record.fairUsagePolicy?.trim() || "Fair-use policy applies; supplier details are shown during purchase."
      : null,
    shortInfo: record.shortInfo?.trim() || null,
    otherInfo: record.operator.otherInfo?.trim() || null,
    lastSyncedAt:
      record.state?.lastSyncedAt?.toISOString() ??
      record.state?.updatedAt?.toISOString() ??
      record.updatedAt.toISOString(),
  };
}

function planOrder(left: StorefrontPlan, right: StorefrontPlan): number {
  if (left.price.currency === right.price.currency) {
    return left.price.cents - right.price.cents || left.title.localeCompare(right.title);
  }
  return left.price.currency.localeCompare(right.price.currency) || left.title.localeCompare(right.title);
}

export async function getStorefrontPlansForCountry(slug: string): Promise<StorefrontPlan[]> {
  const records = await prisma.package.findMany({
    where: publicSellablePackageWhere({
      operator: { is: { country: { is: { slug } } } },
    }),
    include: STOREFRONT_PACKAGE_INCLUDE,
  });

  return records.map(mapStorefrontPlan).sort(planOrder);
}

export async function getStorefrontPlan(identifier: string): Promise<StorefrontPlan | null> {
  const identifierWhere = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)
    ? { OR: [{ airaloPackageId: identifier }, { id: identifier }] }
    : { airaloPackageId: identifier };
  const record = await prisma.package.findFirst({
    where: publicSellablePackageWhere(identifierWhere),
    include: STOREFRONT_PACKAGE_INCLUDE,
  });

  return record ? mapStorefrontPlan(record) : null;
}

export async function getStorefrontPlanIdentifiers(): Promise<string[]> {
  const records = await prisma.package.findMany({
    where: publicSellablePackageWhere(),
    select: { airaloPackageId: true },
  });
  return records.map((record) => record.airaloPackageId);
}

export async function getRegionalStorefrontPlans(): Promise<StorefrontPlan[]> {
  const records = await prisma.package.findMany({
    where: publicSellablePackageWhere({
      operator: {
        is: {
          country: {
            is: { slug: { in: [...AFRICA_ROUTE_REGION_SLUGS] } },
          },
        },
      },
    }),
    include: STOREFRONT_PACKAGE_INCLUDE,
  });

  return records.map(mapStorefrontPlan).sort(planOrder);
}

export async function getLocalStorefrontPlans(): Promise<StorefrontPlan[]> {
  const records = await prisma.package.findMany({
    where: publicSellablePackageWhere({
      operator: {
        is: {
          country: {
            is: { countryCode: { in: [...AFRICA_COUNTRY_CODES] } },
          },
        },
      },
    }),
    include: STOREFRONT_PACKAGE_INCLUDE,
  });

  return records.map(mapStorefrontPlan).sort(planOrder);
}

export async function getStorefrontCountries(): Promise<StorefrontCountry[]> {
  const records = await prisma.package.findMany({
    where: publicSellablePackageWhere({
      operator: {
        is: {
          country: {
            is: { countryCode: { in: [...AFRICA_COUNTRY_CODES] } },
          },
        },
      },
    }),
    include: STOREFRONT_PACKAGE_INCLUDE,
  });

  const countries = new Map<string, StorefrontCountry>();

  for (const record of records) {
    const candidate = toCountry(record);
    const current = countries.get(candidate.slug);

    if (!current) {
      countries.set(candidate.slug, candidate);
      continue;
    }

    current.planCount += 1;
    if (
      candidate.minimumPrice.currency === current.minimumPrice.currency &&
      candidate.minimumPrice.amount < current.minimumPrice.amount
    ) {
      current.minimumPrice = candidate.minimumPrice;
    }
  }

  return Array.from(countries.values()).sort((left, right) =>
    left.title.localeCompare(right.title, "en", { sensitivity: "base" }),
  );
}

export function planCoversDestination(
  plan: StorefrontPlan,
  destination: Pick<StorefrontCountry, "slug" | "countryCode" | "title">,
): boolean {
  const code = destination.countryCode.trim().toUpperCase();
  const slug = slugify(destination.slug || destination.title);

  return plan.coverage.some(
    (covered) =>
      (Boolean(code) && covered.code?.toUpperCase() === code) ||
      covered.slug === slug ||
      slugify(covered.name) === slug,
  );
}

export function planCoversEveryDestination(
  plan: StorefrontPlan,
  destinations: Array<Pick<StorefrontCountry, "slug" | "countryCode" | "title">>,
): boolean {
  return plan.coverageVerified && destinations.every((destination) => planCoversDestination(plan, destination));
}
