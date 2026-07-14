import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/overview",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight text-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-[4px] border-2 border-primary"
      />
      <span className="text-body-lg leading-none">Platform Control</span>
    </Link>
  );
}
