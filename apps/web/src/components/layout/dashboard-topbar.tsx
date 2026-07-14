"use client";

import { usePathname } from "next/navigation";
import { UserNav } from "@/components/layout/user-nav";
import { PLATFORM_LABELS } from "@/lib/jobs/types";

function titleFromPathname(pathname: string): string {
  if (pathname === "/overview") return "Overview";
  if (pathname === "/jobs") return "Jobs";
  if (pathname.startsWith("/jobs/")) return "Job detail";
  if (pathname === "/run") return "Run";
  if (pathname.startsWith("/run/andrewbiggs")) return PLATFORM_LABELS.andrewbiggs;
  if (pathname.startsWith("/run/edlearning")) return PLATFORM_LABELS.edlearning;
  if (pathname.startsWith("/run/speexx")) return PLATFORM_LABELS.speexx;
  if (pathname === "/admin/users") return "Users";
  if (pathname === "/admin/audit") return "Audit log";
  return "Platform Control";
}

export function DashboardTopbar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const title = titleFromPathname(pathname);

  return (
    <header className="glass-chrome sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-3 border-b px-4 md:px-6">
      <h1 className="min-w-0 truncate text-body font-semibold tracking-tight">{title}</h1>
      <UserNav className="shrink-0" userName={userName} userEmail={userEmail} variant="topbar" />
    </header>
  );
}
