"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  PlayCircle,
  Users,
  ScrollText,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserNav } from "@/components/layout/user-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: ListTodo },
  { href: "/run", label: "Run", icon: PlayCircle },
];

const adminNavItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-small transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Sidebar({
  isAdmin,
  userName,
  userEmail,
}: {
  isAdmin: boolean;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-56 md:flex-col md:border-r md:border-border md:bg-surface-raised">
      <div className="flex h-14 shrink-0 items-center gap-3 px-5">
        <span className="h-4 w-4 shrink-0 rounded-[4px] border-2 border-primary" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-body font-bold tracking-tight">Platform Control</p>
          <p className="truncate text-caption text-muted-foreground">Internal ops</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3">
        <nav className="flex flex-col gap-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}

          {isAdmin ? (
            <>
              <Separator className="my-2" />
              <p className="px-3 py-1 text-caption font-medium text-muted-foreground">Admin</p>
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                />
              ))}
            </>
          ) : null}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-3">
        <UserNav userName={userName} userEmail={userEmail} variant="sidebar" />
      </div>
    </aside>
  );
}

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const mobileItems = isAdmin
    ? [navItems[0], navItems[1], navItems[2], adminNavItems[0]]
    : [navItems[0], navItems[1], navItems[2]];

  const overflowAdminItems = isAdmin ? [adminNavItems[1]] : [];

  return (
    <nav className="glass-chrome fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden">
      {mobileItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-caption",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      {isAdmin && overflowAdminItems.length > 0 ? (
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-caption",
                overflowAdminItems.some(
                  (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
                )
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl pb-8">
            <SheetHeader>
              <SheetTitle>Admin</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-1">
              {overflowAdminItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Button key={item.href} variant={active ? "secondary" : "ghost"} className="justify-start gap-3" asChild>
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </nav>
  );
}
