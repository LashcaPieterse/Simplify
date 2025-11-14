interface PaymentStatusBannerProps {
  status: string;
  message?: string;
}

const STATUS_COPY: Record<string, { title: string; description: string; tone: "info" | "success" | "error" }> = {
  pending: {
    title: "Awaiting payment",
    description: "We are waiting for confirmation from the payment provider.",
    tone: "info",
  },
  approved: {
    title: "Payment approved",
    description: "Your payment was approved. We are finalising your order now.",
    tone: "success",
  },
  paid: {
    title: "Payment complete",
    description: "Payment confirmed. Preparing your eSIM details…",
    tone: "success",
  },
  failed: {
    title: "Payment failed",
    description: "The payment was declined. Please retry or use a different method.",
    tone: "error",
  },
  cancelled: {
    title: "Payment cancelled",
    description: "The payment was cancelled before completion.",
    tone: "error",
  },
};

function toneClasses(tone: "info" | "success" | "error"): string {
  switch (tone) {
    case "success":
      return "border-green-200 bg-green-50 text-green-800";
    case "error":
      return "border-red-200 bg-red-50 text-red-800";
    case "info":
    default:
      return "border-blue-200 bg-blue-50 text-blue-800";
  }
}

export function PaymentStatusBanner({ status, message }: PaymentStatusBannerProps) {
  const key = status?.toLowerCase() ?? "pending";
  const copy = STATUS_COPY[key] ?? STATUS_COPY.pending;
  const tone = copy.tone;

  return (
    <div className={`rounded-md border p-4 ${toneClasses(tone)}`}>
      <p className="text-sm font-semibold">{copy.title}</p>
      <p className="mt-1 text-sm">{message ?? copy.description}</p>
    </div>
  );
}
