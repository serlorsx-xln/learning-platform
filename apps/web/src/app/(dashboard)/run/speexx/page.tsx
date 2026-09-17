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
import { ListLoadingSkeleton } from "@/components/run/list-loading-skeleton";
import {
  CookieEntries,
  cookieEntriesToRecord,
  createCookieEntry,
  type CookieEntry,
} from "@/components/run/cookie-entries";

interface ActivityItem {
  id: string | number;
  title: string;
  result?: string;
  elapsedTime?: string | number;
  elapsedTimeFormatted?: string;
  isComplete: boolean;
  status: "complete" | "pending";
}

interface ActivitySummary {
  total: number;
  pending: number;
  complete: number;
}

interface LevelInfo {
  currentLevel: { id: number; name: string };
  nextLevels: { id: number; name: string; achieved: boolean; current: boolean }[];
  totalElapsedSeconds: number;
  levelAchieved: boolean;
  levelTestTotal: number;
  levelTestFinished: number;
}

export default function SpeexxRunPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"password" | "cookie">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookieEntries, setCookieEntries] = useState<CookieEntry[]>([createCookieEntry()]);
  const [doActivity, setDoActivity] = useState(true);
  const [test, setTest] = useState(false);
  const [targetPercent, setTargetPercent] = useState("100");
  const [delayPerFolder, setDelayPerFolder] = useState("0");
  const [targetElapsedHours, setTargetElapsedHours] = useState("");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [goingNext, setGoingNext] = useState(false);

  function buildCredentials() {
    if (authMode === "password") {
      return { email, username: email, password };
    }
    return { cookies: cookieEntriesToRecord(cookieEntries) };
  }

  function validateAuth(): boolean {
    if (authMode === "password") {
      if (!email.trim() || !password) {
        toast.error("Email and password are required");
        return false;
      }
      return true;
    }
    const cookies = cookieEntriesToRecord(cookieEntries);
    if (Object.keys(cookies).length === 0) {
      toast.error("Add at least one cookie name and value");
      return false;
    }
    return true;
  }

  async function loadStatus() {
    if (!validateAuth()) return;

    setLoadingStatus(true);
    const body =
      authMode === "password"
        ? { authMode, email, username: email, password }
        : { authMode, cookies: cookieEntriesToRecord(cookieEntries) };

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

    // Load level info (elapsed time + current/next levels)
    const levelBody =
      authMode === "password"
        ? { authMode, email, username: email, password }
        : { authMode, cookies: cookieEntriesToRecord(cookieEntries) };
    const levelRes = await fetch("/api/speexx/level-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(levelBody),
    });
    if (levelRes.ok) {
      setLevelInfo(await levelRes.json());
    }
  }

  async function goToNextLevel() {
    if (!levelInfo?.nextLevels?.length) return;
    const next = levelInfo.nextLevels.find((l) => !l.achieved && !l.current) ?? levelInfo.nextLevels[0];
    if (!next) return;

    setGoingNext(true);
    const body =
      authMode === "password"
        ? { authMode, email, username: email, password, targetLevelId: next.id }
        : { authMode, cookies: cookieEntriesToRecord(cookieEntries), targetLevelId: next.id };

    const res = await fetch("/api/speexx/go-to-next-level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setGoingNext(false);

    if (!res.ok) {
      toast.error("Failed to go to next level");
      return;
    }
    const data = await res.json();
    if (data.success) {
      toast.success(`Submitted ${data.submittedTests} tests for level ${next.name}`);
      // Reload level info + activities
      loadStatus();
    } else {
      toast.error(data.message ?? "Failed to go to next level");
    }
  }

  function formatElapsed(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAuth()) return;

    setLoading(true);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "speexx",
        credentials: buildCredentials(),
        config: {
          authMode,
          doActivity,
          test,
          targetPercent: Number(targetPercent) || 100,
          delayPerFolder: Number(delayPerFolder) || 0,
          targetElapsedHours: targetElapsedHours ? Number(targetElapsedHours) : null,
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/run" className="text-small text-muted-foreground hover:text-foreground">
          ← Back to Run
        </Link>
        <PageHeader
          className="mt-3"
          title="Speexx"
          subtitle="Load activity status first. Default: 100% activities; enable certificate test only when needed. Use cookie auth if password login fails."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Email/password or cookie session. For cookies, name each key yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
            </>
          ) : (
            <CookieEntries entries={cookieEntries} onChange={setCookieEntries} />
          )}

          <Button type="button" variant="secondary" onClick={loadStatus} disabled={loadingStatus}>
            {loadingStatus ? "Loading..." : "Load activity status"}
          </Button>
        </CardContent>
      </Card>

      {loadingStatus ? <ListLoadingSkeleton rows={4} /> : null}

      {!loadingStatus && summary ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Activity status</CardTitle>
              {articleId ? (
                <span className="text-caption text-muted-foreground">Article {articleId}</span>
              ) : null}
            </div>
            <CardDescription>
              Pending items will be skipped when already complete during the run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CompletionSummary
              total={summary.total}
              pending={summary.pending}
              complete={summary.complete}
            />

            {levelInfo ? (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-small">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current level</span>
                  <strong className="text-foreground">{levelInfo.currentLevel?.name ?? "—"}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total study time</span>
                  <strong className="text-foreground">
                    {formatElapsed(levelInfo.totalElapsedSeconds)}
                  </strong>
                </div>
                {levelInfo.levelTestTotal > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Level test</span>
                    <strong className={levelInfo.levelAchieved ? "text-foreground" : "text-amber-600"}>
                      {levelInfo.levelTestFinished}/{levelInfo.levelTestTotal} {levelInfo.levelAchieved ? "✓ passed" : "not passed"}
                    </strong>
                  </div>
                ) : null}
                {levelInfo.nextLevels?.length ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Next levels</span>
                    <span className="text-foreground">
                      {levelInfo.nextLevels
                        .filter((l) => !l.achieved && !l.current)
                        .map((l) => l.name)
                        .join(", ") || "—"}
                    </span>
                  </div>
                ) : null}
                {pending.length === 0 && !levelInfo.levelAchieved ? (
                  <p className="text-small text-amber-600 pt-1">
                    Exercises complete — run certificate/level test to pass this level first.
                  </p>
                ) : null}
                {pending.length === 0 && levelInfo.levelAchieved && levelInfo.nextLevels?.some((l) => !l.achieved && !l.current) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={goingNext}
                    onClick={goToNextLevel}
                  >
                    {goingNext
                      ? "Going to next level..."
                      : `Go to next level (${
                          levelInfo.nextLevels.find((l) => !l.achieved && !l.current)?.name ?? ""
                        })`}
                  </Button>
                ) : null}
              </div>
            ) : null}
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
                  <div
                    key={String(item.id)}
                    className="flex items-center justify-between gap-2 text-small opacity-70"
                  >
                    <span className="truncate">{item.title}</span>
                    <CompletionBadge status="complete" isComplete />
                  </div>
                ))}
                {complete.length > 5 ? (
                  <p className="text-caption text-muted-foreground">+{complete.length - 5} more</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Run</CardTitle>
          <CardDescription>
            Recommended: load status, then run with activities at 100%. Toggle certificate test
            separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <Checkbox checked={doActivity} onCheckedChange={(v) => setDoActivity(v === true)} />
                <span className="text-small">
                  Do activity (exercises) - skips completed automatically
                </span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox checked={test} onCheckedChange={(v) => setTest(v === true)} />
                <span className="text-small">Run certificate / level test</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetPercent">Target percent (1-100)</Label>
                <Input
                  id="targetPercent"
                  type="number"
                  min="1"
                  max="100"
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay">Delay per folder (seconds)</Label>
                <Input
                  id="delay"
                  type="number"
                  min="0"
                  value={delayPerFolder}
                  onChange={(e) => setDelayPerFolder(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="targetElapsedHours">Total hours to add (empty = random 30-40s/exercise)</Label>
                <Input
                  id="targetElapsedHours"
                  type="number"
                  min="0.1"
                  step="0.5"
                  placeholder="e.g. 5 (adds 5h distributed across pending exercises)"
                  value={targetElapsedHours}
                  onChange={(e) => setTargetElapsedHours(e.target.value)}
                />
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
