"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { CompletionBadge, CompletionSummary } from "@/components/run/completion-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityItem {
  id: string | number;
  title: string;
  result?: string;
  isComplete: boolean;
  status: "complete" | "pending";
}

interface ActivitySummary {
  total: number;
  pending: number;
  complete: number;
}

export default function SpeexxRunPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"password" | "cookie">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authCmru, setAuthCmru] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [doActivity, setDoActivity] = useState(true);
  const [test, setTest] = useState(false);
  const [targetPercent, setTargetPercent] = useState("100");
  const [delayPerFolder, setDelayPerFolder] = useState("0");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    setLoadingStatus(true);
    const body =
      authMode === "password"
        ? { authMode, email, username: email, password }
        : { authMode, cookies: { AUTH_CMRU: authCmru, AUTHENTICATION_TOKEN: authToken } };

    const response = await fetch("/api/speexx/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoadingStatus(false);

    if (!response.ok) {
      toast.error("Failed to load activity status");
      return;
    }

    const data = await response.json();
    setActivities(data.activities ?? []);
    setSummary(data.summary ?? null);
    setArticleId(data.articleId ?? null);
    toast.success(
      `Loaded ${data.summary?.total ?? 0} activities - ${data.summary?.pending ?? 0} pending`
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const credentials =
      authMode === "password"
        ? { email, username: email, password }
        : {
            cookies: {
              AUTH_CMRU: authCmru,
              AUTHENTICATION_TOKEN: authToken,
            },
          };

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "speexx",
        credentials,
        config: {
          authMode,
          doActivity,
          test,
          targetPercent: Number(targetPercent) || 100,
          delayPerFolder: Number(delayPerFolder) || 0,
        },
      }),
    });

    setLoading(false);

    if (!response.ok) {
      toast.error("Failed to create job");
      return;
    }

    const data = await response.json();
    toast.success("Job started");
    router.push(`/jobs/${data.jobId}`);
  }

  const pending = activities.filter((a) => !a.isComplete);
  const complete = activities.filter((a) => a.isComplete);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/run" className="text-small text-muted-foreground hover:text-foreground">
          ← Back to Run
        </Link>
        <PageHeader
          className="mt-3"
          description="Load activity status first. Default: 100% activities; enable certificate test only when needed. Use cookie auth if password login fails."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job configuration</CardTitle>
          <CardDescription>
            Recommended: load status, then run with activities at 100%. Toggle certificate test separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Authentication mode</Label>
              <Select value={authMode} onValueChange={(v) => setAuthMode(v as "password" | "cookie")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Email / password</SelectItem>
                  <SelectItem value="cookie">Cookie session</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authMode === "password" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="authCmru">AUTH_CMRU</Label>
                  <Input id="authCmru" value={authCmru} onChange={(e) => setAuthCmru(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authToken">AUTHENTICATION_TOKEN</Label>
                  <Input id="authToken" value={authToken} onChange={(e) => setAuthToken(e.target.value)} required />
                </div>
              </>
            )}

            <Button type="button" variant="secondary" onClick={loadStatus} disabled={loadingStatus}>
              {loadingStatus ? "Loading..." : "Load activity status"}
            </Button>

            {loadingStatus ? (
              <div className="space-y-3 rounded-md border border-border p-4">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : null}

            {!loadingStatus && summary ? (
              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-small font-medium">Activity status</p>
                  {articleId ? <span className="text-caption text-muted-foreground">Article {articleId}</span> : null}
                </div>
                <CompletionSummary total={summary.total} pending={summary.pending} complete={summary.complete} />
                {pending.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-eyebrow">Pending</p>
                    {pending.map((item) => (
                      <div key={String(item.id)} className="flex items-center justify-between gap-2 text-small">
                        <span className="truncate">{item.title}</span>
                        <CompletionBadge status="pending" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-small text-muted-foreground">All activities are complete.</p>
                )}
                {complete.length > 0 ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-eyebrow">Complete ({complete.length})</p>
                    {complete.slice(0, 5).map((item) => (
                      <div key={String(item.id)} className="flex items-center justify-between gap-2 text-small opacity-70">
                        <span className="truncate">{item.title}</span>
                        <CompletionBadge status="complete" isComplete />
                      </div>
                    ))}
                    {complete.length > 5 ? (
                      <p className="text-caption text-muted-foreground">+{complete.length - 5} more</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-md border border-border p-4">
              <label className="flex items-center gap-3">
                <Checkbox checked={doActivity} onCheckedChange={(v) => setDoActivity(v === true)} />
                <span className="text-small">Do activity (exercises) - skips completed automatically</span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox checked={test} onCheckedChange={(v) => setTest(v === true)} />
                <span className="text-small">Run certificate / level test</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetPercent">Target percent (1-100)</Label>
                <Input id="targetPercent" type="number" min="1" max="100" value={targetPercent} onChange={(e) => setTargetPercent(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay">Delay per folder (seconds)</Label>
                <Input id="delay" type="number" min="0" value={delayPerFolder} onChange={(e) => setDelayPerFolder(e.target.value)} />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Starting..." : "Run job"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
