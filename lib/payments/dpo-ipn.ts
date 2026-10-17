import type { VerifyPaymentTransactionResult } from "./checkouts";

export const DPO_PUSH_EVENT_TYPE = "dpo-push";
export const DPO_PUSH_OK_XML =
  '<?xml version="1.0" encoding="utf-8"?><API3G><Response>OK</Response></API3G>';

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
  verifyPaymentTransaction: (
    transactionId: string,
  ) => Promise<VerifyPaymentTransactionResult>;
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

  // DPO's push payload has no documented signature. Treat every callback as
  // a notification to verify our stored transaction, never as payment evidence.
  // This also prevents failed, mismatched or replayed pushes from downgrading
  // a payment which was already independently approved.
  try {
    const verification = await options.deps.verifyPaymentTransaction(transaction.id);
    if (verification.retryable) {
      return xmlError(503, "verification_unavailable");
    }
  } catch {
    // Preserve payment state and let DPO retry instead of acknowledging a
    // notification whose verification could not complete.
    return xmlError(503, "verification_unavailable");
  }

  return xmlOk();
}

export const handleDpoIpn = handleDpoPushPayment;
