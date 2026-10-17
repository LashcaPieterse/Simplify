import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReceiptEmail,
  resolveReceiptBaseUrl,
  resolveReceiptDeliveryDetails,
} from "./receipts";

const receiptOptions = {
  recipientName: "Test traveller",
  orderReference: "TEST-123",
  planName: "1 GB - 7 days",
  destination: "Test destination",
  amountLabel: "$6",
  status: "completed",
  purchasedAt: "Oct 17, 2026",
  orderLink: "https://sim.africa/orders/test/access?token=test-token",
  installationGuideUrl: "https://sim.africa/help/installation",
  qrCodeUrl: "https://supplier.example/qr?id=test",
  qrCodeData: "LPA:1$rsp.example$MATCHING-ID",
  directAppleUrl: "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=test",
  smdpAddress: "rsp.example",
  activationCode: "MATCHING-ID",
  manualInstallation: "<p>To access data:</p><ol><li>Enable data roaming.</li></ol><p>To top up:</p><p>Visit airalo.com/my-esims in the Airalo app.</p>",
  activationPolicy: "first-usage",
  apn: "N/A",
  whatsappUrl: null,
};

test("both email formats contain readable setup and SIM.Africa top-up instructions", () => {
  const receipt = buildReceiptEmail(receiptOptions);
  for (const body of [receipt.text, receipt.html]) {
    assert.match(body, /Enable data roaming/);
    assert.match(body, /iPhone/);
    assert.match(body, /Android/);
    assert.match(body, /MATCHING-ID/);
    assert.match(body, /rsp\.example/);
    assert.match(body, /first connects to a supported network/);
    assert.match(body, /automatic settings/);
    assert.match(body, /Availability depends on your eSIM/);
    assert.match(body, /https:\/\/sim\.africa\/orders\/test\/access\?token=test-token/);
    assert.doesNotMatch(body, /airalo\.com\/my-esims|Airalo app|first-usage|APN: N\/A/);
    assert.doesNotMatch(body, /&lt;\/?(?:p|ol|li)&gt;/);
  }
  assert.doesNotMatch(receipt.text, /<\/?(?:p|ol|li)>/);
  assert.match(receipt.html, /href="https:\/\/supplier\.example\/qr|src="https:\/\/supplier\.example\/qr/);
  assert.match(receipt.html, /href="https:\/\/esimsetup\.apple\.com/);
  assert.match(receipt.html, /<ol[^>]*><li>Enable data roaming\.<\/li><\/ol>/);
});

test("supplier and customer text cannot inject email markup", () => {
  const receipt = buildReceiptEmail({
    ...receiptOptions,
    recipientName: '<img src=x onerror="alert(1)">',
    manualInstallation: '<script>alert("supplier")</script><p>Keep roaming on &amp; select the eSIM.</p><img src=x onerror="alert(2)">',
    activationCode: 'MATCHING<&"ID',
  });
  assert.doesNotMatch(receipt.html, /<script|<img src=x|onerror="/);
  assert.doesNotMatch(receipt.text, /<script|alert\("supplier"\)/);
  assert.match(receipt.html, /Keep roaming on &amp; select the eSIM/);
  assert.match(receipt.html, /MATCHING&lt;&amp;&quot;ID/);
  assert.match(receipt.text, /MATCHING<&"ID/);
});

test("missing manual values and unknown activation policy do not invent setup data", () => {
  const receipt = buildReceiptEmail({
    ...receiptOptions,
    smdpAddress: null,
    activationCode: null,
    qrCodeData: null,
    manualInstallation: null,
    activationPolicy: null,
    apn: null,
  });
  for (const body of [receipt.text, receipt.html]) {
    assert.match(body, /If separate manual values are missing/);
    assert.match(body, /Check the activation policy/);
    assert.doesNotMatch(body, /MATCHING-ID|first connects to a supported network/);
  }
});

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
