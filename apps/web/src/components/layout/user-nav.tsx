"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { getInitials } from "@/lib/user-display";
import { cn } from "@/lib/utils";
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
  className?: string;
}

export function UserNav({ userName, userEmail, className }: UserNavProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const initials = getInitials(userName);

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-9 gap-2 px-2", className)}
          aria-label="Account menu"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-caption font-medium">
            {initials || <UserIcon className="h-3.5 w-3.5" />}
          </span>
          <span className="hidden text-small sm:inline">{userName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-small font-medium text-foreground">{userName}</p>
            {userEmail ? (
              <p className="text-caption text-muted-foreground">{userEmail}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          disabled={loading}
          className="cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          {loading ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
