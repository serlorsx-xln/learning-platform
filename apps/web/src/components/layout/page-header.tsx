import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ eyebrow, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      {(eyebrow || description) && (
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
          {description ? <p className="max-w-3xl text-small text-muted-foreground">{description}</p> : null}
        </div>
      )}
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
