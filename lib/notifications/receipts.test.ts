import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveReceiptBaseUrl,
  resolveReceiptDeliveryDetails,
} from "./receipts";

test("receipt delivery waits for personalised installation credentials", () => {
  assert.equal(resolveReceiptDeliveryDetails(null).ready, false);
  assert.equal(
    resolveReceiptDeliveryDetails({ source: "order", qrCodeUrl: null }).ready,
    false,
  );
});

test("receipt delivery accepts QR and manual activation values", () => {
  const delivery = resolveReceiptDeliveryDetails({
    qrCodeUrl: "https://sandbox.airalo.com/qr?id=123",
    qrCodeData: "LPA:1$rsp.example$MATCHING-ID",
    lpa: "rsp.example",
    matchingId: "MATCHING-ID",
    directAppleUrl: "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=test",
    apn: "globaldata",
  });

  assert.equal(delivery.ready, true);
  assert.equal(delivery.smdpAddress, "rsp.example");
  assert.equal(delivery.activationCode, "MATCHING-ID");
  assert.equal(delivery.apn, "globaldata");
});

test("receipt delivery does not expose unsafe supplier URLs", () => {
  const delivery = resolveReceiptDeliveryDetails({
    qrCodeUrl: "javascript:alert(1)",
    directAppleUrl: "data:text/html,unsafe",
  });

  assert.equal(delivery.ready, false);
  assert.equal(delivery.qrCodeUrl, null);
  assert.equal(delivery.directAppleUrl, null);
});

test("profile activation code can make a fulfilled order deliverable", () => {
  const delivery = resolveReceiptDeliveryDetails(null, " ACTIVATION-123 ");
  assert.equal(delivery.ready, true);
  assert.equal(delivery.activationCode, "ACTIVATION-123");
});

test("receipt links use only a normalized trusted HTTP origin", () => {
  assert.equal(
    resolveReceiptBaseUrl({
      baseUrl: "https://sim.africa/orders/example?token=ignored",
      configuredUrl: null,
      vercelUrl: null,
      nodeEnv: "production",
    }),
    "https://sim.africa",
  );
  assert.equal(
    resolveReceiptBaseUrl({
      baseUrl: "javascript:alert(1)",
      configuredUrl: "https://sim.africa",
      vercelUrl: null,
      nodeEnv: "production",
    }),
    null,
  );
});

test("production receipt delivery fails closed without a canonical app URL", () => {
  assert.equal(
    resolveReceiptBaseUrl({
      baseUrl: null,
      configuredUrl: null,
      vercelUrl: null,
      nodeEnv: "production",
    }),
    null,
  );
  assert.equal(
    resolveReceiptBaseUrl({
      baseUrl: null,
      configuredUrl: null,
      vercelUrl: null,
      nodeEnv: "development",
    }),
    "http://localhost:3000",
  );
});
