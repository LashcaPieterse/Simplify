import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReceiptActivationPolicy,
  formatReceiptApn,
  formatReceiptInstructions,
} from "./receipt-content";

const supplierInstructions = `
  <p><b>eSIM name:</b>&nbsp;Safari &amp; Travel</p>
  <p><b>Coverage:</b> Kenya, Tanzania, Uganda</p>
  <p>To install manually:</p>
  <ol><li>Enter the SM-DP+ address and activation code.</li><li>Label the eSIM.</li></ol>
  <p>To access data:</p><ol><li>Enable data roaming.</li><li>Set the APN to globaldata.</li></ol>
  <p><b>To top up:</b></p>
  <p>Visit airalo.com/my-esims or the Airalo website/app and open “My eSIMs”.</p>
  <p><br></p><p><br></p><p><br></p>
`;

test("supplier HTML becomes readable paragraphs and numbered instructions", () => {
  const text = formatReceiptInstructions(supplierInstructions)!;
  assert.match(text, /eSIM name: Safari & Travel/);
  assert.match(text, /Coverage: Kenya, Tanzania, Uganda/);
  assert.match(text, /1\. Enter the SM-DP\+ address and activation code/);
  assert.match(text, /2\. Label the eSIM/);
  assert.match(text, /Enable data roaming/);
  assert.match(text, /Set the APN to globaldata/);
  assert.doesNotMatch(text, /<\/?(?:p|b|ol|li|br)\b|&(?:nbsp|amp);|\n{3,}/);
  assert.doesNotMatch(text, /airalo|my esims|top[\s-]*up/i);
});

test("supplier scripts, styles and image tracking are omitted", () => {
  const text = formatReceiptInstructions(`<script>steal()</script><style>.hidden {color:red}</style><p>Keep <b>roaming</b> on.</p><img src="https://tracker.example/pixel" onerror="steal()">`)!;
  assert.equal(text, "Keep roaming on.");
});

test("plain-text network settings and supplier activation addresses are preserved", () => {
  assert.equal(
    formatReceiptInstructions("SM-DP+ address: lpa.airalo.com\nAPN: globaldata\nEnable data roaming."),
    "SM-DP+ address: lpa.airalo.com\nAPN: globaldata\nEnable data roaming.",
  );
  assert.equal(formatReceiptInstructions(null), null);
  assert.equal(formatReceiptInstructions("<p>&nbsp;</p>"), null);
});

test("activation distinguishes first network connection from installation", () => {
  assert.match(formatReceiptActivationPolicy("first-usage"), /first connects to a supported network/);
  assert.match(formatReceiptActivationPolicy("first-usage"), /any covered country/);
  assert.match(formatReceiptActivationPolicy("installation"), /as soon as you install/);
  assert.doesNotMatch(formatReceiptActivationPolicy("installation"), /first connects/);
  assert.match(formatReceiptActivationPolicy(null), /Check the activation policy/);
  assert.match(formatReceiptActivationPolicy("unknown-policy"), /Contact support/);
  assert.equal(formatReceiptActivationPolicy("<p>Valid for 30 days after installation.</p>"), "Valid for 30 days after installation.");
});

test("APN placeholders get automatic-settings guidance without inventing an APN", () => {
  for (const value of [null, "", " N/A ", "n/a", "None", "automatic"]) {
    assert.match(formatReceiptApn(value), /No manual APN was supplied/);
    assert.match(formatReceiptApn(value), /automatic settings/);
  }
  assert.match(formatReceiptApn(" globaldata "), /^Enter globaldata exactly/);
});
