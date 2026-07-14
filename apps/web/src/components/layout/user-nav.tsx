"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/lib/auth-client";
import { getInitials } from "@/lib/user-display";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserNavProps {
  userName: string;
  userEmail?: string;
  variant?: "topbar" | "sidebar";
  className?: string;
}

export function UserNav({ userName, userEmail, variant = "topbar", className }: UserNavProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await fetch("/api/audit/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      }).catch(() => null);

      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login");
            router.refresh();
          },
        },
      });
    } catch {
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  const isDark = theme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            variant === "sidebar" ? "h-auto w-full justify-start gap-3 px-2 py-2" : "h-9 w-9 rounded-full p-0",
            className
          )}
        >
          <Avatar className={cn(variant === "sidebar" ? "h-8 w-8" : "h-8 w-8")}>
            <AvatarFallback className="bg-primary/10 text-primary">{getInitials(userName)}</AvatarFallback>
          </Avatar>
          {variant === "sidebar" ? (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-small font-medium">{userName}</p>
              {userEmail ? (
                <p className="truncate text-caption text-muted-foreground">{userEmail}</p>
              ) : null}
            </div>
          ) : (
            <span className="sr-only">Open user menu</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-small font-medium">{userName}</p>
            {userEmail ? <p className="text-caption text-muted-foreground">{userEmail}</p> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="cursor-pointer"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          disabled={loading}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {loading ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
