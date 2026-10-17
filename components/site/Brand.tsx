import { Globe2 } from "lucide-react";
import { cn } from "@/components/utils";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", inverse ? "text-white" : "text-brand-900")}>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", inverse ? "bg-accent-200 text-brand-900" : "bg-brand-900 text-accent-200")}>
        <Globe2 className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
      </span>
      <span className="text-[1.4rem] font-bold tracking-[-0.065em]">sim<span className={inverse ? "text-accent-200" : "text-brand-500"}>.</span>africa</span>
    </span>
  );
}
