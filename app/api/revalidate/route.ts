import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

type SanityWebhookPayload = {
  _type?: string;
  slug?: { current?: string } | string;
  paths?: string[];
  secret?: string;
};

const PREVIEW_SECRET = process.env.SANITY_PREVIEW_SECRET;

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
  const body = (await request.json().catch(() => null)) as SanityWebhookPayload | null;
  const secret = request.headers.get("x-sanity-secret") ?? body?.secret;

  if (!body || !secret || secret !== PREVIEW_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const slugValue = typeof body?.slug === "string" ? body.slug : body?.slug?.current;
  const paths = new Set(body.paths ?? pathForDocument(body._type, slugValue));

  paths.add("/");
  if (body._type === "post") {
    paths.add("/resources");
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths: Array.from(paths) });
}
