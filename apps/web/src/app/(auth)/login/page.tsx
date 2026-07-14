"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "banned") {
      setError("Your account has been disabled. Contact an administrator.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Invalid credentials");
      setLoading(false);
      return;
    }

    const check = await fetch("/api/auth/me");
    if (check.status === 403) {
      setError("Your account has been disabled. Contact an administrator.");
      setLoading(false);
      return;
    }

    router.push("/overview");
    router.refresh();

    void fetch("/api/audit/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login" }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-small text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden flex-1 flex-col justify-between border-r border-border bg-surface-raised p-6 md:flex md:p-8">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 shrink-0 rounded-[4px] border-2 border-primary" aria-hidden />
          <p className="text-body-lg font-bold tracking-tight">Platform Control</p>
        </div>
        <div className="space-y-3">
          <p className="text-eyebrow">Internal ops</p>
          <h1 className="max-w-md text-h1 font-bold">
            Automation control for learning platforms.
          </h1>
          <p className="max-w-md text-body-lg text-muted-foreground">
            Dispatch jobs, monitor progress, and manage operator access from a single calm workspace.
          </p>
        </div>
        <p className="text-caption text-muted-foreground">Tailscale-only · Encrypted credentials</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="md:hidden">
            <p className="text-eyebrow">Platform Control</p>
            <h1 className="mt-1 text-h1 font-bold">Sign in</h1>
            <p className="mt-1 text-small text-muted-foreground">Internal automation dashboard</p>
          </div>

          <Card>
            <CardHeader className="hidden md:block">
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Internal dashboard access</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<p className="text-small text-muted-foreground">Loading...</p>}>
                <LoginForm />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
