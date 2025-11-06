import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

const PREVIEW_SECRET = process.env.SANITY_PREVIEW_SECRET;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug") ?? "/";

  if (!secret || secret !== PREVIEW_SECRET) {
    return NextResponse.json({ message: "Invalid preview secret" }, { status: 401 });
  }

  draftMode().enable();

  const redirectUrl = slug.startsWith("/") ? slug : `/${slug}`;

  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
