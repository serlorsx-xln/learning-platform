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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModuleItem {
  nodeId: number;
  name: string;
  progress: number;
  lessonCount: number;
  completeLessons: number;
  incompleteLessons: number;
  isComplete: boolean;
  status: "complete" | "in_progress" | "not_started";
}

interface ModuleSummary {
  total: number;
  pending: number;
  complete: number;
}

export default function EdLearningRunPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("ru");
  const [educationId, setEducationId] = useState("ed22");
  const [minutesToAdd, setMinutesToAdd] = useState("0");
  const [runMode, setRunMode] = useState<"full" | "time_only">("full");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [summary, setSummary] = useState<ModuleSummary | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const pendingModules = modules.filter((m) => !m.isComplete);
  const completeModules = modules.filter((m) => m.isComplete);

  async function loadModules() {
    setLoadingModules(true);
    const response = await fetch("/api/edlearning/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, school, educationId }),
    });
    setLoadingModules(false);

    if (!response.ok) {
      toast.error("Failed to load modules");
      return;
    }

    const data = await response.json();
    const loaded: ModuleItem[] = data.modules ?? [];
    setModules(loaded);
    setSummary(data.summary ?? null);
    setSelected([]);
    toast.success(
      `Loaded ${loaded.length} modules - ${data.summary?.pending ?? 0} pending, ${data.summary?.complete ?? 0} complete`
    );
  }

  function toggleModule(nodeId: number, isComplete: boolean) {
    if (isComplete) return;
    setSelected((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  }

  function selectAllPending() {
    setSelected(pendingModules.map((m) => m.nodeId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const minutes = Number(minutesToAdd) || 0;

    if (runMode === "full") {
      if (selected.length === 0) {
        toast.error("Select at least one pending module");
        return;
      }
    } else if (minutes <= 0) {
      toast.error("Enter minutes to add for time-only mode");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "edlearning",
        credentials: { username, password, school, educationId },
        config: {
          school,
          educationId,
          mode: runMode,
          moduleIds: runMode === "time_only" ? [] : selected,
          minutesToAdd: minutes,
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

  function renderModule(module: ModuleItem) {
    const disabled = module.isComplete;
    return (
      <label
        key={module.nodeId}
        className={`flex items-center gap-3 rounded-md border border-border px-3 py-2 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent/30"
        }`}
      >
        <Checkbox
          checked={selected.includes(module.nodeId)}
          disabled={disabled}
          onCheckedChange={() => toggleModule(module.nodeId, module.isComplete)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-small font-medium">{module.name}</p>
            <CompletionBadge status={module.status} isComplete={module.isComplete} />
          </div>
          <p className="text-caption text-muted-foreground">
            {Math.round(module.progress * 100)}% module · {module.completeLessons}/{module.lessonCount}{" "}
            lessons done
            {module.incompleteLessons > 0 ? ` · ${module.incompleteLessons} pending` : ""}
          </p>
        </div>
      </label>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/run" className="text-small text-muted-foreground hover:text-foreground">
          ← Back to Run
        </Link>
        <PageHeader
          className="mt-3"
          description="Load modules to see progress. Choose full run (submit tasks/tests) or time-only mode like the original script."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school">School</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="educationId">Education ID</Label>
              <Input id="educationId" value={educationId} onChange={(e) => setEducationId(e.target.value)} />
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={loadModules} disabled={loadingModules}>
            {loadingModules ? "Loading..." : "Load modules"}
          </Button>
        </CardContent>
      </Card>

      {loadingModules ? (
        <ListLoadingSkeleton />
      ) : modules.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              {summary ? (
                <CompletionSummary
                  total={summary.total}
                  pending={summary.pending}
                  complete={summary.complete}
                />
              ) : (
                runMode === "full"
                  ? "Select pending modules to process"
                  : "Time-only mode uses all modules - no selection needed"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Run mode</Label>
                <Select value={runMode} onValueChange={(v) => setRunMode(v as "full" | "time_only")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full - submit tasks, tests, optional time</SelectItem>
                    <SelectItem value="time_only">Time only - ping lessons across all modules</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {runMode === "full" ? (
                pendingModules.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-eyebrow">Pending</p>
                      <Button type="button" variant="ghost" size="sm" onClick={selectAllPending}>
                        Select all pending
                      </Button>
                    </div>
                    {pendingModules.map(renderModule)}
                  </div>
                ) : (
                  <p className="text-small text-muted-foreground">All modules are complete.</p>
                )
              ) : (
                <p className="text-small text-muted-foreground">
                  Skips task submission and tests. Adds learning time across every module in the course.
                </p>
              )}

              {runMode === "full" && completeModules.length > 0 ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowComplete((v) => !v)}
                  >
                    {showComplete ? "Hide" : "Show"} {completeModules.length} completed module
                    {completeModules.length === 1 ? "" : "s"}
                  </Button>
                  {showComplete ? completeModules.map(renderModule) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="minutes">
                  {runMode === "time_only"
                    ? "Minutes to add"
                    : "Minutes to add (optional - applies to all modules when set)"}
                </Label>
                <Input
                  id="minutes"
                  type="number"
                  min="0"
                  value={minutesToAdd}
                  onChange={(e) => setMinutesToAdd(e.target.value)}
                  required={runMode === "time_only"}
                />
              </div>
              <Button
                type="submit"
                disabled={
                  loading ||
                  (runMode === "full" ? selected.length === 0 : (Number(minutesToAdd) || 0) <= 0)
                }
                className="w-full"
              >
                {loading
                  ? "Starting..."
                  : runMode === "time_only"
                    ? `Run time-only job (${Number(minutesToAdd) || 0} min)`
                    : `Run job (${selected.length} module${selected.length === 1 ? "" : "s"})`}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
