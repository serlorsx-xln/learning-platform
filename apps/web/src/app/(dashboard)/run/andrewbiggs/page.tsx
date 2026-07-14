"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/layout/page-header";
import { CompletionBadge, CompletionSummary } from "@/components/run/completion-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListLoadingSkeleton } from "@/components/run/list-loading-skeleton";

interface CourseItem {
  url: string;
  title: string;
  totalLessons: number;
  completeLessons: number;
  incompleteLessons: number;
  isComplete: boolean;
  status: "complete" | "in_progress" | "not_started";
}

interface CourseSummary {
  total: number;
  pending: number;
  complete: number;
}

export default function AndrewBiggsRunPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const [delay, setDelay] = useState("0.5");
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [summary, setSummary] = useState<CourseSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const pendingCourses = courses.filter((c) => !c.isComplete);
  const completeCourses = courses.filter((c) => c.isComplete);

  async function loadCourses() {
    setLoadingCourses(true);
    const courseUrls = extraUrls
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);

    const response = await fetch("/api/andrewbiggs/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, courseUrls }),
    });
    setLoadingCourses(false);

    if (!response.ok) {
      toast.error("Failed to load courses");
      return;
    }

    const data = await response.json();
    const loaded: CourseItem[] = data.courses ?? [];
    setCourses(loaded);
    setSummary(data.summary ?? null);
    setSelected([]);
    toast.success(
      `Loaded ${loaded.length} courses - ${data.summary?.pending ?? 0} pending, ${data.summary?.complete ?? 0} complete`
    );
  }

  function toggleCourse(url: string, isComplete: boolean) {
    if (isComplete) return;
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  function selectAllPending() {
    setSelected(pendingCourses.map((c) => c.url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      toast.error("Select at least one pending course");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "andrewbiggs",
        credentials: { email, username: email, password },
        config: { courses: selected, delay: Number(delay) || 0.5 },
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

  function renderCourse(course: CourseItem) {
    const disabled = course.isComplete;
    return (
      <label
        key={course.url}
        className={`flex items-start gap-3 rounded-md border border-border px-3 py-2 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent/30"
        }`}
      >
        <Checkbox
          checked={selected.includes(course.url)}
          disabled={disabled}
          onCheckedChange={() => toggleCourse(course.url, course.isComplete)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-small font-medium">{course.title}</p>
            <CompletionBadge status={course.status} isComplete={course.isComplete} />
          </div>
          <p className="text-caption text-muted-foreground">
            {course.completeLessons}/{course.totalLessons} lessons done
            {course.incompleteLessons > 0 ? ` · ${course.incompleteLessons} pending` : ""}
          </p>
          <p className="mt-1 truncate text-caption text-muted-foreground">{course.url}</p>
        </div>
      </label>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/run" className="text-small text-muted-foreground hover:text-foreground">
          ← Back to Run
        </Link>
        <PageHeader
          className="mt-3"
          title="Andrew Biggs"
          subtitle="Load courses, select pending ones, then run. Only incomplete lessons are processed (faster than the original script)."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Credentials are encrypted and stored in job history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extraUrls">Extra course URLs (optional, one per line)</Label>
            <textarea
              id="extraUrls"
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-body shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={extraUrls}
              onChange={(e) => setExtraUrls(e.target.value)}
              placeholder="https://ondemand.andrewbiggs.com/courses/..."
            />
          </div>
          <Button type="button" variant="secondary" onClick={loadCourses} disabled={loadingCourses}>
            {loadingCourses ? "Loading..." : "Load courses"}
          </Button>
        </CardContent>
      </Card>

      {loadingCourses ? (
        <ListLoadingSkeleton />
      ) : courses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
            <CardDescription>
              {summary ? (
                <CompletionSummary
                  total={summary.total}
                  pending={summary.pending}
                  complete={summary.complete}
                />
              ) : (
                "Select pending courses"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {pendingCourses.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-eyebrow">Pending</p>
                    <Button type="button" variant="ghost" size="sm" onClick={selectAllPending}>
                      Select all pending
                    </Button>
                  </div>
                  {pendingCourses.map(renderCourse)}
                </div>
              ) : (
                <p className="text-small text-muted-foreground">All courses are complete.</p>
              )}

              {completeCourses.length > 0 ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowComplete((v) => !v)}
                  >
                    {showComplete ? "Hide" : "Show"} {completeCourses.length} completed course
                    {completeCourses.length === 1 ? "" : "s"}
                  </Button>
                  {showComplete ? completeCourses.map(renderCourse) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="delay">Delay between lessons (seconds)</Label>
                <Input id="delay" type="number" step="0.1" min="0" value={delay} onChange={(e) => setDelay(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading || selected.length === 0} className="w-full">
                {loading ? "Starting..." : `Run job (${selected.length} course${selected.length === 1 ? "" : "s"})`}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
