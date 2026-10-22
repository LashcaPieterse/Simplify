# Travel guide authoring

Published guides are repository-owned Markdown files in `content/resources/`. A content change is published by deploying the application. There is no content service, webhook, preview secret, or runtime content API.

Use the article slug as the filename and keep existing slugs stable to preserve inbound links:

```markdown
---
title: "Pre-flight eSIM checklist"
slug: "pre-flight-esim-checklist"
excerpt: "Ensure your device and plan are ready before you leave home."
publishedAt: "2025-11-30T20:01:34.803Z"
readingMinutes: 4
tags: ["Tips"]
coverImage: "/images/resources/pre-flight-esim-checklist.jpg"
---

Write the guide here using Markdown paragraphs, headings, lists, emphasis, and links.
```

Title, slug, excerpt, publication date, reading time, and a nonempty body are required. Tags default to an empty list; the cover image is optional. Dates must be ISO timestamps with a timezone. Invalid metadata, duplicate slugs, filename mismatches, and missing cover images fail loading rather than quietly hiding the article.

Store covers and inline images in `public/images/resources/`. Reference them with `/images/resources/filename.ext`, including Markdown reference-style images. Remote images are rejected and local files must exist. Raw HTML is disabled; Markdown links retain the renderer's safe default URL handling. Resource pages, static route generation, and the sitemap share one loader and newest-first ordering.

Guides whose titles or slugs explicitly name an earlier calendar year remain hidden until editorial updates them. Evergreen guides remain visible. Preserve archived Markdown files even when the date rule hides them.

Validate edits with `node --import tsx --test lib/content/*.test.ts`, `npm run typecheck`, and `npm run build`, using Node 22. Images are served as local assets; Markdown files are explicitly included in the deployment's server file traces.
