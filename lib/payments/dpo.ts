import crypto from "node:crypto";

export type DpoClientOptions = {
  companyToken: string;
  serviceUrl: string;
  paymentUrl: string;
  merchantId: string;
  apiKey: string;
};

export type CreateDpoTransactionInput = {
  amount: number;
  currency: string;
  customerEmail?: string | null;
  redirectUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  account?: string;
  reference?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type CreateDpoTransactionResult = {
  token: string;
  redirectUrl: string;
  reference?: string;
  rawResponse: unknown;
};

export type VerifyDpoTransactionResult = {
  status: string;
  resultCode?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  rawResponse: unknown;
};

const JSON_CONTENT_TYPE = "application/json";

function normaliseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function buildSignaturePayload(fields: Record<string, string | number | undefined>): string {
  return Object.values(fields)
    .filter((value): value is string | number => value !== undefined)
    .map((value) => String(value))
    .join("");
}

export class DpoClient {
  private readonly companyToken: string;
  private readonly merchantId: string;
  private readonly apiKey: string;
  private readonly serviceUrl: string;
  private readonly paymentUrl: string;

  constructor(options: DpoClientOptions) {
    this.companyToken = options.companyToken;
    this.merchantId = options.merchantId;
    this.apiKey = options.apiKey;
    this.serviceUrl = normaliseUrl(options.serviceUrl);
    this.paymentUrl = normaliseUrl(options.paymentUrl);
  }

  private sign(fields: Record<string, string | number | undefined>): string {
    const payload = buildSignaturePayload(fields) + this.apiKey;
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  private async fetchJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
    const response = await fetch(input, init);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DPO request failed with ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  async createTransaction(input: CreateDpoTransactionInput): Promise<CreateDpoTransactionResult> {
    const url = `${this.serviceUrl}/transactions`; // Endpoint per DPO REST docs

    const payload: Record<string, unknown> = {
      CompanyToken: this.companyToken,
      MerchantId: this.merchantId,
      Amount: input.amount,
      Currency: input.currency,
      RedirectURL: input.redirectUrl,
      BackURL: input.cancelUrl,
      CallBackURL: input.callbackUrl,
      CustomerEmail: input.customerEmail ?? undefined,
      Account: input.account ?? undefined,
      CompanyRef: input.reference ?? undefined,
      CompanyAccRef: input.description ?? undefined,
      MetaData: input.metadata ?? undefined,
    };

    const signature = this.sign({
      CompanyToken: this.companyToken,
      MerchantId: this.merchantId,
      Amount: input.amount,
      Currency: input.currency,
      RedirectURL: input.redirectUrl,
      BackURL: input.cancelUrl,
    });

    const body = JSON.stringify({ ...payload, Signature: signature });

    const data = await this.fetchJson<Record<string, unknown>>(url, {
      method: "POST",
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
      },
      body,
    });

    const token = String(data?.TransactionToken ?? data?.TransactionRef ?? "").trim();

    if (!token) {
      throw new Error("DPO response did not include a transaction token.");
    }

    const redirectUrl = `${this.paymentUrl}/v1/hosted/pay?TransactionToken=${encodeURIComponent(token)}`;

    return {
      token,
      redirectUrl,
      reference: typeof data?.TransactionRef === "string" ? data.TransactionRef : undefined,
      rawResponse: data,
    };
  }

  async verifyTransaction(token: string): Promise<VerifyDpoTransactionResult> {
    const url = `${this.serviceUrl}/transactions/${encodeURIComponent(token)}`;

    const payload = {
      CompanyToken: this.companyToken,
      MerchantId: this.merchantId,
      TransactionToken: token,
    };

    const signature = this.sign({
      CompanyToken: this.companyToken,
      MerchantId: this.merchantId,
      TransactionToken: token,
    });

    const data = await this.fetchJson<Record<string, unknown>>(url, {
      method: "POST",
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify({ ...payload, Signature: signature }),
    });

    const status = String(data?.Result ?? data?.ResultCode ?? data?.Status ?? "unknown");

    return {
      status,
      resultCode: typeof data?.ResultCode === "string" ? data.ResultCode : undefined,
      reference: typeof data?.TransactionRef === "string" ? data.TransactionRef : undefined,
      amount: typeof data?.Amount === "number" ? data.Amount : undefined,
      currency: typeof data?.Currency === "string" ? data.Currency : undefined,
      rawResponse: data,
    };
  }
}

export function resolveDpoClient(): DpoClient {
  const merchantId = process.env.DPO_MERCHANT_ID;
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const apiKey = process.env.DPO_API_KEY;
  const serviceUrl = process.env.DPO_SERVICE_URL ?? "https://secure.3gdirectpay.com/api/v1";
  const paymentUrl = process.env.DPO_PAYMENT_URL ?? "https://secure.3gdirectpay.com";

  if (!merchantId || !companyToken || !apiKey) {
    throw new Error(
      "DPO_MERCHANT_ID, DPO_COMPANY_TOKEN and DPO_API_KEY must be configured to create payments.",
    );
  }

  return new DpoClient({
    merchantId,
    companyToken,
    apiKey,
    serviceUrl,
    paymentUrl,
  });
}
