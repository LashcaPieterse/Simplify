export type DpoClientOptions = {
  companyToken: string;
  serviceUrl: string;
  paymentUrl: string;
  serviceType: string;
};

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
    const response = await fetch(input, init);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DPO request failed with ${response.status}: ${text}`);
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
    const serviceDescription = input.serviceDescription ?? input.serviceName ?? "Simplify eSIM plan";
    const serviceName = input.serviceName ?? "Simplify eSIM";
    const serviceId = input.serviceId ?? input.reference;

    const xml = [
      `<API3G>`,
      `<CompanyToken>${this.companyToken}</CompanyToken>`,
      `<Request>createToken</Request>`,
      `<Transaction>`,
      `<PaymentAmount>${input.amount}</PaymentAmount>`,
      `<PaymentCurrency>${input.currency}</PaymentCurrency>`,
      `<CompanyRef>${input.reference}</CompanyRef>`,
      `<CompanyRefUnique>0</CompanyRefUnique>`,
      `<PTL>${ptl}</PTL>`,
      input.customerEmail ? `<CustomerEmail>${input.customerEmail}</CustomerEmail>` : "",
      `<RedirectURL>${input.redirectUrl}</RedirectURL>`,
      `<BackURL>${input.cancelUrl}</BackURL>`,
      `<CallBackURL>${input.callbackUrl}</CallBackURL>`,
      `</Transaction>`,
      `<Services>`,
      `<Service>`,
      `<ServiceType>${this.serviceType}</ServiceType>`,
      serviceDescription ? `<ServiceDescription>${serviceDescription}</ServiceDescription>` : "",
      serviceId ? `<ServiceID>${serviceId}</ServiceID>` : "",
      serviceName ? `<ServiceTypeName>${serviceName}</ServiceTypeName>` : "",
      `<ServiceDate>${serviceDate}</ServiceDate>`,
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
    });

    const result = extractTag(responseXml, "Result");
    const resultExplanation = extractTag(responseXml, "ResultExplanation");
    if (result && result !== "000") {
      const error = resultExplanation ?? "DPO createToken failed";
      throw new Error(error);
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
      resultCode: result,
      resultExplanation,
      allocationId: extractTag(responseXml, "AllocationID"),
      allocationCode: extractTag(responseXml, "AllocationCode"),
      rawResponse: responseXml,
    };
  }

  async verifyTransaction(token: string, companyRef?: string): Promise<VerifyDpoTransactionResult> {
    const url = `${this.serviceUrl}/`;

    const xml = [
      `<API3G>`,
      `<CompanyToken>${this.companyToken}</CompanyToken>`,
      `<Request>verifyToken</Request>`,
      `<TransactionToken>${token}</TransactionToken>`,
      companyRef ? `<CompanyRef>${companyRef}</CompanyRef>` : "",
      `<VerifyTransaction>1</VerifyTransaction>`,
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
      fraudExplanation: extractTag(responseXml, "FraudExplanation"),
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

export function resolveDpoClient(): DpoClient {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const serviceType = process.env.DPO_SERVICE_TYPE;
  const serviceUrl = process.env.DPO_SERVICE_URL ?? "https://secure.3gdirectpay.com/API/v6";
  const paymentUrl = process.env.DPO_PAYMENT_URL ?? "https://secure.3gdirectpay.com";

  if (!companyToken || !serviceType) {
    throw new Error("DPO_COMPANY_TOKEN and DPO_SERVICE_TYPE must be configured to create payments.");
  }

  return new DpoClient({
    companyToken,
    serviceType,
    serviceUrl,
    paymentUrl,
  });
}
