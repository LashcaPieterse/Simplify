import type { DpoMode } from "@prisma/client";

export type DpoClientOptions = {
  companyToken: string;
  serviceUrl: string;
  paymentUrl: string;
  serviceType: string;
};

export class DpoCreationRejectedError extends Error {}

export type CreateDpoTransactionInput = {
  amount: number;
  currency: string;
  reference: string; // CompanyRef
  description?: string; // optional label/intent
  metadata?: Record<string, unknown>;
  customerEmail?: string | null;
  redirectUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  paymentTimeLimitMinutes?: number; // PTL
  serviceDescription?: string;
  serviceId?: string | number;
  serviceName?: string;
};

export type CreateDpoTransactionResult = {
  token: string;
  redirectUrl: string;
  reference?: string;
  transactionRef?: string;
  resultCode?: string;
  resultExplanation?: string;
  allocationId?: string;
  allocationCode?: string;
  rawResponse: unknown;
};

export type VerifyDpoTransactionResult = {
  status: string;
  resultCode?: string;
  resultExplanation?: string;
  approval?: string;
  fraudAlert?: string;
  fraudExplanation?: string;
  amount?: number;
  currency?: string;
  netAmount?: number;
  settlementDate?: string;
  rollingReserveAmount?: number;
  rollingReserveDate?: string;
  customerPhone?: string;
  customerCountry?: string;
  customerAddress?: string;
  customerCity?: string;
  customerZip?: string;
  accRef?: string;
  rawResponse: unknown;
};

function normaliseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function escapeXml(value: string | number): string {
  return String(value).replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case "\"":
        return "&quot;";
      default:
        return character;
    }
  });
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim();
}

export class DpoClient {
  private readonly companyToken: string;
  private readonly serviceUrl: string;
  private readonly paymentUrl: string;
  private readonly serviceType: string;

  constructor(options: DpoClientOptions) {
    this.companyToken = options.companyToken;
    this.serviceUrl = normaliseUrl(options.serviceUrl);
    this.paymentUrl = normaliseUrl(options.paymentUrl);
    this.serviceType = options.serviceType;
  }

  private async fetchXml(input: RequestInfo | URL, init: RequestInit = {}): Promise<string> {
    const response = await fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(15_000) });

    if (!response.ok) {
      throw new Error(`DPO request failed with HTTP ${response.status}.`);
    }

    return response.text();
  }

  async createTransaction(input: CreateDpoTransactionInput): Promise<CreateDpoTransactionResult> {
    const url = `${this.serviceUrl}/`;
    const now = new Date();
    const serviceDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(
      now.getHours(),
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const ptl = input.paymentTimeLimitMinutes ?? 5;
    const serviceDescription = input.serviceDescription ?? input.serviceName ?? "SIM.Africa eSIM plan";
    const serviceName = input.serviceName ?? "SIM.Africa eSIM";
    const serviceId = input.serviceId ?? input.reference;

    const xml = [
      `<API3G>`,
      `<CompanyToken>${escapeXml(this.companyToken)}</CompanyToken>`,
      `<Request>createToken</Request>`,
      `<Transaction>`,
      `<PaymentAmount>${escapeXml(input.amount.toFixed(2))}</PaymentAmount>`,
      `<PaymentCurrency>${escapeXml(input.currency)}</PaymentCurrency>`,
      `<TransactionChargeType>1</TransactionChargeType>`,
      `<CompanyRef>${escapeXml(input.reference)}</CompanyRef>`,
      `<CompanyRefUnique>0</CompanyRefUnique>`,
      `<PTL>${escapeXml(ptl)}</PTL>`,
      `<PTLtype>minutes</PTLtype>`,
      input.customerEmail ? `<CustomerEmail>${escapeXml(input.customerEmail)}</CustomerEmail>` : "",
      `<RedirectURL>${escapeXml(input.redirectUrl)}</RedirectURL>`,
      `<BackURL>${escapeXml(input.cancelUrl)}</BackURL>`,
      `<CallBackURL>${escapeXml(input.callbackUrl)}</CallBackURL>`,
      `</Transaction>`,
      `<Services>`,
      `<Service>`,
      `<ServiceType>${escapeXml(this.serviceType)}</ServiceType>`,
      serviceDescription ? `<ServiceDescription>${escapeXml(serviceDescription)}</ServiceDescription>` : "",
      serviceId ? `<ServiceID>${escapeXml(serviceId)}</ServiceID>` : "",
      serviceName ? `<ServiceTypeName>${escapeXml(serviceName)}</ServiceTypeName>` : "",
      `<ServiceDate>${escapeXml(serviceDate)}</ServiceDate>`,
      `</Service>`,
      `</Services>`,
      `</API3G>`,
    ]
      .filter(Boolean)
      .join("");

    const responseXml = await this.fetchXml(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml",
      },
      body: xml,
      signal: AbortSignal.timeout(30_000),
    });

    const result = extractTag(responseXml, "Result");
    const resultExplanation = extractTag(responseXml, "ResultExplanation");
    if (result && result !== "000") {
      throw new DpoCreationRejectedError(`DPO rejected payment creation (${result}).`);
    }

    const token = extractTag(responseXml, "TransToken") ?? extractTag(responseXml, "TransactionToken") ?? "";

    if (!token) {
      throw new Error("DPO response did not include a transaction token.");
    }

    const redirectUrl = `${this.paymentUrl}/payv2.php?ID=${encodeURIComponent(token)}`;

    return {
      token,
      redirectUrl,
      reference: input.reference,
      transactionRef:
        extractTag(responseXml, "TransRef") ??
        extractTag(responseXml, "TransactionRef"),
      resultCode: result,
      resultExplanation,
      allocationId: extractTag(responseXml, "AllocationID"),
      allocationCode: extractTag(responseXml, "AllocationCode"),
      rawResponse: responseXml,
    };
  }

  async verifyTransaction(token: string, companyRef?: string, options: { markProcessed?: boolean } = {}): Promise<VerifyDpoTransactionResult> {
    const url = `${this.serviceUrl}/`;

    const xml = [
      `<API3G>`,
      `<CompanyToken>${escapeXml(this.companyToken)}</CompanyToken>`,
      `<Request>verifyToken</Request>`,
      token ? `<TransactionToken>${escapeXml(token)}</TransactionToken>` : "",
      companyRef ? `<CompanyRef>${escapeXml(companyRef)}</CompanyRef>` : "",
      `<VerifyTransaction>${options.markProcessed ? "1" : "0"}</VerifyTransaction>`,
      `</API3G>`,
    ].join("");

    const responseXml = await this.fetchXml(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml",
      },
      body: xml,
    });

    const status = extractTag(responseXml, "Result") ?? "unknown";
    const amountStr = extractTag(responseXml, "TransactionAmount");
    const currency = extractTag(responseXml, "TransactionCurrency");

    return {
      status,
      resultCode: status,
      resultExplanation: extractTag(responseXml, "ResultExplanation"),
      approval: extractTag(responseXml, "TransactionApproval"),
      fraudAlert: extractTag(responseXml, "FraudAlert"),
      fraudExplanation:
        extractTag(responseXml, "FraudExplanation") ??
        extractTag(responseXml, "FraudExplnation"),
      amount: amountStr ? Number(amountStr) : undefined,
      currency,
      netAmount: extractTag(responseXml, "TransactionNetAmount")
        ? Number(extractTag(responseXml, "TransactionNetAmount"))
        : undefined,
      settlementDate: extractTag(responseXml, "TransactionSettlementDate"),
      rollingReserveAmount: extractTag(responseXml, "TransactionRollingReserveAmount")
        ? Number(extractTag(responseXml, "TransactionRollingReserveAmount"))
        : undefined,
      rollingReserveDate: extractTag(responseXml, "TransactionRollingReserveDate"),
      customerPhone: extractTag(responseXml, "CustomerPhone"),
      customerCountry: extractTag(responseXml, "CustomerCountry"),
      customerAddress: extractTag(responseXml, "CustomerAddress"),
      customerCity: extractTag(responseXml, "CustomerCity"),
      customerZip: extractTag(responseXml, "CustomerZip"),
      accRef: extractTag(responseXml, "AccRef"),
      rawResponse: responseXml,
    };
  }
}

export function isDpoMode(value: unknown): value is DpoMode {
  return value === "test" || value === "live";
}

function resolveDpoCredentials(mode: DpoMode | null) {
  if (!isDpoMode(mode)) {
    throw new Error("Payment transaction has no valid DPO mode.");
  }

  const prefix = mode === "live" ? "DPO_LIVE" : "DPO_TEST";
  const explicitToken = process.env[`${prefix}_COMPANY_TOKEN`]?.trim();
  const explicitServiceType = process.env[`${prefix}_SERVICE_TYPE`]?.trim();
  // Fall back as a complete pair only; never combine credentials from accounts.
  const useLegacy = mode === "test" && !explicitToken && !explicitServiceType;
  const companyToken = useLegacy ? process.env.DPO_COMPANY_TOKEN?.trim() : explicitToken;
  const serviceType = useLegacy ? process.env.DPO_SERVICE_TYPE?.trim() : explicitServiceType;

  if (!companyToken || !serviceType) {
    throw new Error(`DPO ${mode} credentials are not fully configured.`);
  }

  return { companyToken, serviceType };
}

export function getDpoCredentialStatus(): Record<DpoMode, boolean> {
  const configured = (mode: DpoMode) => {
    try {
      resolveDpoCredentials(mode);
      return true;
    } catch {
      return false;
    }
  };
  return { test: configured("test"), live: configured("live") };
}

export function resolveDpoClient(mode: DpoMode | null): DpoClient {
  const { companyToken, serviceType } = resolveDpoCredentials(mode);
  const serviceUrl = process.env.DPO_SERVICE_URL ?? "https://secure.3gdirectpay.com/API/v6";
  const paymentUrl = process.env.DPO_PAYMENT_URL ?? "https://secure.3gdirectpay.com";

  return new DpoClient({
    companyToken,
    serviceType,
    serviceUrl,
    paymentUrl,
  });
}
