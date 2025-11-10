'use client';

import { Studio } from "next-sanity/studio";
import config from "@/sanity.config";

export default function StudioPage() {
  return <Studio config={config} />;
}
