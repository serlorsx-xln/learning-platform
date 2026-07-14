"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PLATFORM_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANTS, type JobStatus } from "@/lib/jobs/types";
import { formatDate } from "@/lib/utils";

interface JobDetail {
  id: string;
  platform: keyof typeof PLATFORM_LABELS;
  status: JobStatus;
  accountLabel: string;
  configJson: string;
  summaryJson: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface JobEvent {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}

export function JobDetailView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => setJob(data.job));

    const source = new EventSource(`/api/jobs/${jobId}/stream`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "snapshot") {
        setEvents(data.events);
        if (data.job) setJob(data.job);
      } else if (data.type === "event") {
        setEvents((prev) => [...prev, data.event]);
        if (data.job) setJob(data.job);
      }
    };

    return () => source.close();
  }, [jobId]);

  if (!job) {
    return <p className="text-small text-muted-foreground">Loading job...</p>;
  }

  const summary = job.summaryJson ? JSON.parse(job.summaryJson) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="text-small text-muted-foreground hover:text-foreground">
          ← Back to jobs
        </Link>
        <PageHeader className="mt-3" description={`${PLATFORM_LABELS[job.platform]} · ${job.accountLabel}`}>
          <Badge variant={STATUS_BADGE_VARIANTS[job.status]}>{STATUS_LABELS[job.status]}</Badge>
        </PageHeader>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-small font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent className="text-body">{formatDate(job.createdAt)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-small font-medium text-muted-foreground">Started</CardTitle>
          </CardHeader>
          <CardContent className="text-body">{formatDate(job.startedAt)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-small font-medium text-muted-foreground">Finished</CardTitle>
          </CardHeader>
          <CardContent className="text-body">{formatDate(job.finishedAt)}</CardContent>
        </Card>
      </div>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-caption">
              {JSON.stringify(summary, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-small text-muted-foreground">Waiting for events...</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex gap-3 border-l-2 border-border pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-body">{event.message}</p>
                  <p className="text-caption text-muted-foreground">{formatDate(event.createdAt)}</p>
                </div>
                <Badge
                  variant={
                    event.level === "error" ? "destructive" : event.level === "warn" ? "warning" : "muted"
                  }
                >
                  {event.level}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
