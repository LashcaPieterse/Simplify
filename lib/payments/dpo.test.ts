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
