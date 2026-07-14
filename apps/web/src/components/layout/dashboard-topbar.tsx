import Link from "next/link";
import { UserNav } from "@/components/layout/user-nav";
import { ModeToggle } from "@/components/theme/mode-toggle";

export function DashboardTopbar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  return (
    <header className="z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <Link
        href="/overview"
        className="truncate text-small font-semibold tracking-tight md:hidden"
      >
        Platform Control
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-1">
        <ModeToggle />
        <div className="ml-1">
          <UserNav userName={userName} userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
