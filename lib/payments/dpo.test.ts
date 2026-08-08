import assert from "node:assert/strict";
import test from "node:test";

import { DpoClient } from "./dpo";

function xmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}

test("DpoClient escapes interpolated XML values when creating transactions", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";

  globalThis.fetch = async (_url, init) => {
    requestBody = String(init?.body ?? "");
    return xmlResponse("<API3G><Result>000</Result><TransToken>token-123</TransToken></API3G>");
  };

  try {
    const client = new DpoClient({
      companyToken: "company<&\"'>",
      serviceUrl: "https://dpo.example/API/v6",
      paymentUrl: "https://pay.example",
      serviceType: "service<&\"'>",
    });

    await client.createTransaction({
      amount: 12.5,
      currency: "U&G",
      reference: "ref<&\"'>",
      customerEmail: "a&b<test@example.com",
      redirectUrl: "https://example.com/return?a=1&b=<2>",
      cancelUrl: "https://example.com/cancel?a=1&b=<2>",
      callbackUrl: "https://example.com/callback?a=1&b=<2>",
      paymentTimeLimitMinutes: 15,
      serviceDescription: "Plan <fast> & \"cheap\" 'now'",
      serviceId: "svc<&\"'>",
      serviceName: "Name <&\"'>",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestBody, /<CompanyToken>company&lt;&amp;&quot;&apos;&gt;<\/CompanyToken>/);
  assert.match(requestBody, /<PaymentCurrency>U&amp;G<\/PaymentCurrency>/);
  assert.match(requestBody, /<CompanyRef>ref&lt;&amp;&quot;&apos;&gt;<\/CompanyRef>/);
  assert.match(requestBody, /<PTL>15<\/PTL>/);
  assert.match(requestBody, /<PTLtype>minutes<\/PTLtype>/);
  assert.match(requestBody, /<CustomerEmail>a&amp;b&lt;test@example.com<\/CustomerEmail>/);
  assert.match(
    requestBody,
    /<RedirectURL>https:\/\/example.com\/return\?a=1&amp;b=&lt;2&gt;<\/RedirectURL>/,
  );
  assert.match(
    requestBody,
    /<ServiceDescription>Plan &lt;fast&gt; &amp; &quot;cheap&quot; &apos;now&apos;<\/ServiceDescription>/,
  );
  assert.match(requestBody, /<ServiceType>service&lt;&amp;&quot;&apos;&gt;<\/ServiceType>/);
  assert.match(requestBody, /<ServiceID>svc&lt;&amp;&quot;&apos;&gt;<\/ServiceID>/);
  assert.match(requestBody, /<ServiceTypeName>Name &lt;&amp;&quot;&apos;&gt;<\/ServiceTypeName>/);
});

test("DpoClient escapes interpolated XML values when verifying transactions", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";

  globalThis.fetch = async (_url, init) => {
    requestBody = String(init?.body ?? "");
    return xmlResponse("<API3G><Result>000</Result></API3G>");
  };

  try {
    const client = new DpoClient({
      companyToken: "company<&\"'>",
      serviceUrl: "https://dpo.example/API/v6",
      paymentUrl: "https://pay.example",
      serviceType: "service",
    });

    await client.verifyTransaction("token<&\"'>", "ref<&\"'>");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestBody, /<CompanyToken>company&lt;&amp;&quot;&apos;&gt;<\/CompanyToken>/);
  assert.match(requestBody, /<TransactionToken>token&lt;&amp;&quot;&apos;&gt;<\/TransactionToken>/);
  assert.match(requestBody, /<CompanyRef>ref&lt;&amp;&quot;&apos;&gt;<\/CompanyRef>/);
});

test("DpoClient parses documented v6 verifyToken payment fields", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    xmlResponse(`
      <API3G>
        <Result>000</Result>
        <ResultExplanation>Transaction Paid</ResultExplanation>
        <CustomerName>Cons Connie</CustomerName>
        <CustomerCredit>4432</CustomerCredit>
        <CustomerCreditType>Mobile</CustomerCreditType>
        <TransactionApproval>RHP2ZIGD5U</TransactionApproval>
        <TransactionCurrency>KES</TransactionCurrency>
        <TransactionAmount>1.00</TransactionAmount>
        <FraudAlert>001</FraudAlert>
        <FraudExplnation>Low Risk (Not checked)</FraudExplnation>
        <TransactionNetAmount>0.99</TransactionNetAmount>
        <TransactionSettlementDate>2023/09/04</TransactionSettlementDate>
        <TransactionRollingReserveAmount>0.00</TransactionRollingReserveAmount>
        <TransactionRollingReserveDate>2023/08/25</TransactionRollingReserveDate>
        <CustomerPhone>706527126</CustomerPhone>
        <CustomerCountry>Kenya</CustomerCountry>
        <CustomerAddress>Nairobi Road</CustomerAddress>
        <CustomerCity>Mombasa</CustomerCity>
        <CustomerZip>80100</CustomerZip>
        <AccRef>ACC-1</AccRef>
      </API3G>
    `);

  try {
    const client = new DpoClient({
      companyToken: "company",
      serviceUrl: "https://dpo.example/API/v6",
      paymentUrl: "https://pay.example",
      serviceType: "service",
    });

    const result = await client.verifyTransaction("token-1", "checkout-1");

    assert.equal(result.resultCode, "000");
    assert.equal(result.resultExplanation, "Transaction Paid");
    assert.equal(result.approval, "RHP2ZIGD5U");
    assert.equal(result.currency, "KES");
    assert.equal(result.amount, 1);
    assert.equal(result.fraudAlert, "001");
    assert.equal(result.fraudExplanation, "Low Risk (Not checked)");
    assert.equal(result.netAmount, 0.99);
    assert.equal(result.settlementDate, "2023/09/04");
    assert.equal(result.rollingReserveAmount, 0);
    assert.equal(result.rollingReserveDate, "2023/08/25");
    assert.equal(result.customerPhone, "706527126");
    assert.equal(result.customerCountry, "Kenya");
    assert.equal(result.customerAddress, "Nairobi Road");
    assert.equal(result.customerCity, "Mombasa");
    assert.equal(result.customerZip, "80100");
    assert.equal(result.accRef, "ACC-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
