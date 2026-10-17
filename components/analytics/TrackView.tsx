"use client";

import { useEffect } from "react";

import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";

export function TrackView({ event, properties = {} }: { event: AnalyticsEventName; properties?: Record<string, string | number | boolean | null> }) {
  useEffect(() => {
    trackEvent(event, properties);
  }, [event, properties]);
  return null;
}
