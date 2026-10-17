"use client";

import { MessageCircle } from "lucide-react";

import { cn } from "@/components/utils";
import { trackEvent } from "@/lib/analytics";

export function WhatsAppSupportLink({
  location,
  className,
  label = "WhatsApp support",
  showIcon = false,
}: {
  location: string;
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const number =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noreferrer"
      className={cn(className)}
      onClick={() =>
        trackEvent("whatsapp_support_clicked", { location })
      }
    >
      {showIcon ? <MessageCircle className="h-4 w-4" aria-hidden /> : null}
      {label}
    </a>
  );
}
