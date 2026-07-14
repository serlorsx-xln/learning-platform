import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CompletionStatus = "complete" | "in_progress" | "not_started" | "pending";

const STATUS_LABELS: Record<CompletionStatus, string> = {
  complete: "Complete",
  in_progress: "In progress",
  not_started: "Not started",
  pending: "Pending",
};

interface CompletionBadgeProps {
  status: CompletionStatus;
  isComplete?: boolean;
  className?: string;
}

export function CompletionBadge({ status, isComplete, className }: CompletionBadgeProps) {
  const resolved = isComplete ? "complete" : status;
  const variant =
    resolved === "complete" ? "success" : resolved === "in_progress" ? "warning" : "muted";
  return (
    <Badge variant={variant} className={cn(className)}>
      {STATUS_LABELS[resolved]}
    </Badge>
  );
}

interface CompletionSummaryProps {
  total: number;
  pending: number;
  complete: number;
  className?: string;
}

export function CompletionSummary({ total, pending, complete, className }: CompletionSummaryProps) {
  return (
    <p className={cn("text-small text-muted-foreground", className)}>
      {pending} pending · {complete} complete · {total} total
    </p>
  );
}
