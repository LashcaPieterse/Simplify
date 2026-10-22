import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getResourcePostBySlug, getResourcePosts, isCurrentResource } from "./resources";

test("evergreen resources remain publishable", () => {
  assert.equal(isCurrentResource({ title: "Pre-flight eSIM checklist", slug: "pre-flight-esim-checklist" }, 2026), true);
});

test("year-stamped travel guides are hidden after their named year", () => {
  assert.equal(isCurrentResource({ title: "2024 coverage guide", slug: "2024-coverage-guide" }, 2026), false);
  assert.equal(isCurrentResource({ title: "2026 coverage guide", slug: "2026-coverage-guide" }, 2026), true);
});

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), "sim-africa-resources-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const contentDirectory = join(root, "content");
  const publicDirectory = join(root, "public");
  await mkdir(contentDirectory);
  await mkdir(join(publicDirectory, "images/resources"), { recursive: true });
  await writeFile(join(publicDirectory, "images/resources/cover.jpg"), "fixture");
  const write = (filename: string, metadata: Record<string, unknown> = {}, body = "A useful travel guide.") => writeFile(join(contentDirectory, filename), [
    "---",
    ...Object.entries({ title: "Travel guide", slug: filename.replace(/\.md$/, ""), excerpt: "Travel preparation.", publishedAt: "2026-01-01T00:00:00.000Z", readingMinutes: 2, tags: ["Travel"], coverImage: "/images/resources/cover.jpg", ...metadata }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
    "---", "", body,
  ].join("\n"));
  return { contentDirectory, publicDirectory, write };
}

test("local guides retain metadata, sort newest first, and safely resolve known slugs", async (t) => {
  const files = await fixture(t);
  await files.write("older.md");
  await files.write("newer.md", { publishedAt: "2026-02-01T00:00:00.000Z" }, "## Ready\n\nBring your phone.");
  const posts = await getResourcePosts(files);
  assert.deepEqual(posts.map((post) => post.slug), ["newer", "older"]);
  assert.equal(posts[0].body, "## Ready\n\nBring your phone.");
  assert.deepEqual(posts[0].tags, ["Travel"]);
  assert.equal((await getResourcePostBySlug("newer", files))?.title, "Travel guide");
  assert.equal(await getResourcePostBySlug("../../.env.local", files), null);
});

test("invalid metadata and duplicate slugs fail instead of silently hiding content", async (t) => {
  const files = await fixture(t);
  await files.write("a.md", { readingMinutes: 0 });
  await assert.rejects(getResourcePosts(files), /Invalid resource metadata/);
  await files.write("a.md");
  await files.write("b.md", { slug: "a" });
  await assert.rejects(getResourcePosts(files), /Duplicate resource slug/);
  await files.write("b.md", { slug: "different" });
  await assert.rejects(getResourcePosts(files), /filename must match/);
});

test("missing or remote covers, empty bodies and missing content directories fail", async (t) => {
  const files = await fixture(t);
  await files.write("guide.md", { coverImage: "/images/resources/missing.jpg" });
  await assert.rejects(getResourcePosts(files), /Missing resource image/);
  await files.write("guide.md", { coverImage: "https://example.com/cover.jpg" });
  await assert.rejects(getResourcePosts(files), /local \/images\/resources/);
  await files.write("guide.md", {}, " ");
  await assert.rejects(getResourcePosts(files), /Empty resource body/);
  await assert.rejects(getResourcePosts({ ...files, contentDirectory: join(files.contentDirectory, "missing") }), /ENOENT/);
});

test("migrated guides preserve both published URLs and existing year filtering", async () => {
  const posts = await getResourcePosts();
  const checklist = posts.find((post) => post.slug === "pre-flight-esim-checklist");
  const archive = posts.find((post) => post.slug === "2024-coverage-guide-southern-africa");
  assert.ok(checklist);
  assert.ok(archive);
  assert.equal(isCurrentResource(checklist, 2026), true);
  assert.equal(isCurrentResource(archive, 2026), false);
});
