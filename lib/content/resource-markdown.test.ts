import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourceMarkdown } from "../../components/resources/ResourceMarkdown";

const render = (markdown: string) => renderToStaticMarkup(createElement(ResourceMarkdown, null, markdown));

test("resource Markdown preserves headings, emphasis, lists and safe links", () => {
  const html = render("## Checklist\n\n**Install** before departure.\n\n- Keep Wi-Fi on\n\n[Help](/help) and [Provider](https://example.com)");
  assert.match(html, /<h2>Checklist<\/h2>/);
  assert.match(html, /<strong>Install<\/strong>/);
  assert.match(html, /<ul[^>]*>/);
  assert.match(html, /href="\/help"/);
  assert.match(html, /href="https:\/\/example.com" target="_blank" rel="noopener noreferrer"/);
});

test("resource Markdown ignores raw HTML and rejects unsafe URL protocols", () => {
  const html = render('<script>alert(1)</script>\n\n[Unsafe](javascript:alert)');
  assert.doesNotMatch(html, /<script|javascript:/);
});

test("inline and reference images must exist locally", () => {
  assert.throws(() => render("![Missing](/images/resources/missing-image.png)"), /Missing resource image/);
  assert.throws(() => render("![Missing][cover]\n\n[cover]: /images/resources/missing-image.png"), /Missing resource image/);
  assert.throws(() => render("![Remote](https://example.com/image.png)"), /local \/images\/resources/);
  assert.match(render("![Travel](/images/resources/pre-flight-esim-checklist.jpg)"), /<img[^>]*src="\/images\/resources\/pre-flight-esim-checklist.jpg"/);
});
