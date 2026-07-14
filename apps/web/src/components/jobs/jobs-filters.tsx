"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLATFORM_LABELS, STATUS_LABELS, type JobStatus, type Platform } from "@/lib/jobs/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PLATFORMS: Platform[] = ["andrewbiggs", "edlearning", "speexx"];
const STATUSES: JobStatus[] = ["queued", "running", "success", "partial", "failed", "cancelled"];

function buildHref(params: URLSearchParams, updates: Record<string, string | null>) {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-caption transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function JobsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") as Platform | null;
  const status = searchParams.get("status") as JobStatus | null;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  function applyDates(from: string, to: string) {
    router.push(buildHref(searchParams, { dateFrom: from || null, dateTo: to || null }));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-eyebrow mb-2">Platform</p>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All"
            href={buildHref(searchParams, { platform: null })}
            active={!platform}
          />
          {PLATFORMS.map((p) => (
            <FilterChip
              key={p}
              label={PLATFORM_LABELS[p]}
              href={buildHref(searchParams, { platform: p })}
              active={platform === p}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-eyebrow mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All"
            href={buildHref(searchParams, { status: null })}
            active={!status}
          />
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={STATUS_LABELS[s]}
              href={buildHref(searchParams, { status: s })}
              active={status === s}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-eyebrow mb-2">Date range</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="dateFrom" className="text-caption">
              From
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => applyDates(e.target.value, dateTo)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dateTo" className="text-caption">
              To
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => applyDates(dateFrom, e.target.value)}
              className="w-40"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => applyDates("", "")}>
              Clear dates
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
