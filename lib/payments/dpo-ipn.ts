import type { VerifyPaymentTransactionResult } from "./checkouts";

export const DPO_PUSH_EVENT_TYPE = "dpo-push";
export const DPO_PUSH_OK_XML =
  '<?xml version="1.0" encoding="utf-8"?><API3G><Response>OK</Response></API3G>';

const STATUS_FAILED = "failed";
const STATUS_PENDING = "pending";
const STATUS_VERIFICATION_MISMATCH = "verification_mismatch";

const DPO_PUSH_FIELDS = [
  "Result",
  "ResultExplanation",
  "TransactionToken",
  "TransToken",
  "TransactionRef",
  "TransRef",
  "CompanyRef",
  "CustomerName",
  "CustomerCredit",
  "CustomerCreditType",
  "TransactionApproval",
  "TransactionCurrency",
  "TransactionAmount",
  "FraudAlert",
  "FraudExplnation",
  "FraudExplanation",
  "TransactionNetAmount",
  "TransactionSettlementDate",
  "TransactionRollingReserveAmount",
  "TransactionRollingReserveDate",
  "CustomerPhone",
  "CustomerCountry",
  "CustomerAddress",
  "CustomerCity",
  "CustomerZip",
  "MobilePaymentRequest",
  "AccRef",
] as const;

export type DpoPushPayload = Partial<Record<(typeof DPO_PUSH_FIELDS)[number], string>> & {
  rawXml: string;
};

type DpoPushPaymentTransaction = {
  id: string;
  checkoutId: string | null;
  amountCents: number;
  currency: string;
};

type DpoPushDeps = {
  findPaymentTransactionByToken: (
    token: string,
  ) => Promise<DpoPushPaymentTransaction | null>;
  findPaymentTransactionByReference: (
    reference: string,
  ) => Promise<DpoPushPaymentTransaction | null>;
  findPaymentTransactionByCheckoutId: (
    checkoutId: string,
  ) => Promise<DpoPushPaymentTransaction | null>;
  recordPaymentEvent: (
    transactionId: string,
    eventType: string,
    payload: unknown,
  ) => Promise<void>;
  updatePaymentStatus: (
    transactionId: string,
    status: string,
    options: { metadata?: Record<string, unknown> },
  ) => Promise<void>;
  verifyPaymentTransaction: (
    transactionId: string,
  ) => Promise<VerifyPaymentTransactionResult>;
  setCheckoutStatus: (checkoutId: string, status: string) => Promise<void>;
};

export type DpoPushResult = {
  status: number;
  body: string;
};

function xmlError(status: number, code: string): DpoPushResult {
  return {
    status,
    body: `<?xml version="1.0" encoding="utf-8"?><API3G><Response>ERROR</Response><Result>${escapeXml(
      code,
    )}</Result></API3G>`,
  };
}

function xmlOk(): DpoPushResult {
  return {
    status: 200,
    body: DPO_PUSH_OK_XML,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
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

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&");
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const escaped = escapeRegExp(tag);
  const match = xml.match(
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i"),
  );

  return match?.[1] === undefined ? undefined : decodeXml(match[1].trim());
}

export function parseDpoPushPayload(body: string): DpoPushPayload {
  const rawXml = body.trim();

  if (!rawXml || !/<API3G\b/i.test(rawXml)) {
    throw new Error("DPO push payload must be XML with an API3G root.");
  }

  const payload: DpoPushPayload = { rawXml };

  for (const field of DPO_PUSH_FIELDS) {
    const value = extractXmlTag(rawXml, field);
    if (value !== undefined) {
      payload[field] = value;
    }
  }

  if (
    !payload.Result &&
    !payload.TransactionToken &&
    !payload.TransToken &&
    !payload.TransactionRef &&
    !payload.TransRef &&
    !payload.CompanyRef
  ) {
    throw new Error("DPO push payload did not contain transaction fields.");
  }

  return payload;
}

function normalizeResultCode(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeCurrency(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function parseMajorAmountToCents(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = Number(value.trim());
  if (!Number.isFinite(normalized)) {
    return null;
  }

  return Math.round(normalized * 100);
}

function validatePushAmountAndCurrency(
  transaction: DpoPushPaymentTransaction,
  payload: DpoPushPayload,
): string | null {
  const amountCents = parseMajorAmountToCents(payload.TransactionAmount);
  if (amountCents === null) {
    return "DPO push payload did not include a valid transaction amount.";
  }

  if (amountCents !== transaction.amountCents) {
    return `DPO push amount mismatch. Expected ${transaction.amountCents} cents but received ${amountCents} cents.`;
  }

  const currency = normalizeCurrency(payload.TransactionCurrency);
  const expectedCurrency = normalizeCurrency(transaction.currency);
  if (!currency) {
    return "DPO push payload did not include a transaction currency.";
  }

  if (currency !== expectedCurrency) {
    return `DPO push currency mismatch. Expected ${expectedCurrency} but received ${currency}.`;
  }

  return null;
}

async function findPaymentTransaction(
  payload: DpoPushPayload,
  deps: DpoPushDeps,
): Promise<DpoPushPaymentTransaction | null> {
  const token = firstNonEmpty(payload.TransactionToken, payload.TransToken);
  if (token) {
    const transaction = await deps.findPaymentTransactionByToken(token);
    if (transaction) {
      return transaction;
    }
  }

  const reference = firstNonEmpty(payload.TransactionRef, payload.TransRef);
  if (reference) {
    const transaction = await deps.findPaymentTransactionByReference(reference);
    if (transaction) {
      return transaction;
    }

    const checkoutTransaction =
      await deps.findPaymentTransactionByCheckoutId(reference);
    if (checkoutTransaction) {
      return checkoutTransaction;
    }
  }

  const localReference = firstNonEmpty(payload.CompanyRef, payload.AccRef);
  if (localReference) {
    return deps.findPaymentTransactionByCheckoutId(localReference);
  }

  return null;
}

export async function handleDpoPushPayment(options: {
  rawBody: string;
  contentType: string | null;
  deps: DpoPushDeps;
}): Promise<DpoPushResult> {
  const contentType = options.contentType?.toLowerCase() ?? "";
  if (
    contentType &&
    !contentType.includes("xml") &&
    !contentType.includes("text/plain")
  ) {
    return xmlError(415, "unsupported_content_type");
  }

  let payload: DpoPushPayload;
  try {
    payload = parseDpoPushPayload(options.rawBody);
  } catch {
    return xmlError(400, "invalid_xml");
  }

  const transaction = await findPaymentTransaction(payload, options.deps);
  if (!transaction) {
    return xmlError(404, "payment_transaction_not_found");
  }

  await options.deps.recordPaymentEvent(
    transaction.id,
    DPO_PUSH_EVENT_TYPE,
    payload,
  );

  const resultCode = normalizeResultCode(payload.Result);
  if (resultCode !== "000") {
    await options.deps.updatePaymentStatus(transaction.id, STATUS_FAILED, {
      metadata: { source: DPO_PUSH_EVENT_TYPE, payload },
    });
    if (transaction.checkoutId) {
      await options.deps.setCheckoutStatus(transaction.checkoutId, STATUS_FAILED);
    }
    return xmlOk();
  }

  const mismatch = validatePushAmountAndCurrency(transaction, payload);
  if (mismatch) {
    await options.deps.updatePaymentStatus(
      transaction.id,
      STATUS_VERIFICATION_MISMATCH,
      {
        metadata: { source: DPO_PUSH_EVENT_TYPE, reason: mismatch, payload },
      },
    );
    return xmlOk();
  }

  try {
    await options.deps.verifyPaymentTransaction(transaction.id);
  } catch (error) {
    await options.deps.updatePaymentStatus(transaction.id, STATUS_PENDING, {
      metadata: {
        source: DPO_PUSH_EVENT_TYPE,
        payload,
        warning:
          error instanceof Error
            ? error.message
            : "DPO verification failed after push callback.",
      },
    });
  }

  return xmlOk();
}

export const handleDpoIpn = handleDpoPushPayment;
