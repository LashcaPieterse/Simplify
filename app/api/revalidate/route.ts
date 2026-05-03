import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonInvalidJson, jsonValidationError } from "@/lib/api/errors";

const SanityWebhookPayloadSchema = z
  .object({
    _type: z.string().optional(),
    slug: z
      .union([
        z.string(),
        z
          .object({
            current: z.string().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    paths: z.array(z.string()).optional(),
    secret: z.string().optional(),
  })
  .passthrough();

const WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET || process.env.SANITY_PREVIEW_SECRET;

const pathForDocument = (type?: string, slug?: string | null) => {
  if (!type) {
    return [];
  }

  const safeSlug = slug?.replace(/^\//, "") ?? "";

  switch (type) {
    case "homePage":
    case "siteSettings":
      return ["/"];
    case "country":
      return ["/", `/country/${safeSlug}`];
    case "plan":
      return ["/", `/plan/${safeSlug}`];
    case "regionBundle":
      return ["/", `/bundle/${safeSlug}`];
    case "post":
      return ["/resources", `/resources/${safeSlug}`];
    default:
      return ["/"];
  }
};

export async function POST(request: Request) {
  const parseFailed = Symbol("parse_failed");
  const rawBody = await request.json().catch(() => parseFailed);
  if (rawBody === parseFailed) {
    return jsonInvalidJson();
  }

  const parsedBody = SanityWebhookPayloadSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonValidationError(parsedBody.error);
  }

  const body = parsedBody.data;
  const secret = request.headers.get("x-sanity-secret") ?? body?.secret;

  if (!body || !secret || secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const slugValue = typeof body?.slug === "string" ? body.slug : body?.slug?.current;
  const paths = new Set(body.paths ?? pathForDocument(body._type, slugValue));

  paths.add("/");
  if (body._type === "post") {
    paths.add("/resources");
  }

  Array.from(paths).forEach((path) => {
    revalidatePath(path);
  });

  return NextResponse.json({ revalidated: true, paths: Array.from(paths) });
}
