import { eq, desc, and, gte, lte, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { jobs, jobEvents } from "@/lib/db/schema";
import { encryptJson, decryptJson, maskAccountLabel } from "@/lib/crypto/credentials";
import type {
  EventLevel,
  JobConfig,
  JobCredentials,
  JobStatus,
  Platform,
  WorkerEventPayload,
  WorkerRunPayload,
} from "./types";

const WORKER_URLS: Record<Platform, string> = {
  andrewbiggs: process.env.WORKER_ANDREWBIGGS_URL ?? "http://worker-andrewbiggs:8001",
  edlearning: process.env.WORKER_EDLEARNING_URL ?? "http://worker-edlearning:8002",
  speexx: process.env.WORKER_SPEEXX_URL ?? "http://worker-speexx:8003",
};

function accountLabel(credentials: JobCredentials): string {
  return credentials.email ?? credentials.username ?? "unknown";
}

export async function createJob(input: {
  platform: Platform;
  credentials: JobCredentials;
  config: JobConfig;
  createdBy: string;
}) {
  const id = randomUUID();
  const now = new Date();
  const label = accountLabel(input.credentials);

  await db.insert(jobs).values({
    id,
    platform: input.platform,
    status: "queued",
    configJson: JSON.stringify(input.config),
    credentialsEnc: encryptJson(input.credentials),
    accountLabel: maskAccountLabel(label),
    createdBy: input.createdBy,
    createdAt: now,
  });

  await appendJobEvent(id, "info", "Job queued", { platform: input.platform });

  void dispatchJob(id, input.platform, input.credentials, input.config);

  return id;
}

export async function dispatchJob(
  jobId: string,
  platform: Platform,
  credentials: JobCredentials,
  config: JobConfig
) {
  const base =
    process.env.INTERNAL_CALLBACK_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://web:3000";
  const callbackUrl = `${base.replace(/\/$/, "")}/api/internal/jobs/${jobId}/events`;
  const callbackKey = process.env.INTERNAL_API_KEY ?? "";

  const payload: WorkerRunPayload = {
    jobId,
    credentials,
    config,
    callbackUrl,
    callbackKey,
  };

  try {
    await updateJobStatus(jobId, "running", { startedAt: new Date() });
    await appendJobEvent(jobId, "info", "Dispatching to worker");

    const response = await fetch(`${WORKER_URLS[platform]}/internal/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": callbackKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      await updateJobStatus(jobId, "failed", { finishedAt: new Date() });
      await appendJobEvent(jobId, "error", `Worker rejected job: ${text}`);
    }
  } catch (error) {
    await updateJobStatus(jobId, "failed", { finishedAt: new Date() });
    await appendJobEvent(
      jobId,
      "error",
      error instanceof Error ? error.message : "Failed to dispatch job"
    );
  }
}

export async function appendJobEvent(
  jobId: string,
  level: EventLevel,
  message: string,
  payload?: unknown
) {
  await db.insert(jobEvents).values({
    id: randomUUID(),
    jobId,
    level,
    message,
    payloadJson: payload ? JSON.stringify(payload) : null,
    createdAt: new Date(),
  });
}

export async function handleWorkerEvent(jobId: string, data: WorkerEventPayload) {
  if (data.message) {
    await appendJobEvent(jobId, data.level ?? "info", data.message, data.payload);
  }

  if (data.status) {
    const finished = ["success", "partial", "failed", "cancelled"].includes(data.status);
    await updateJobStatus(jobId, data.status, {
      finishedAt: finished ? new Date() : undefined,
      summary: data.summary,
    });
  } else if (data.summary) {
    await db
      .update(jobs)
      .set({ summaryJson: JSON.stringify(data.summary) })
      .where(eq(jobs.id, jobId));
  }
}

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extra?: { startedAt?: Date; finishedAt?: Date; summary?: Record<string, unknown> }
) {
  await db
    .update(jobs)
    .set({
      status,
      ...(extra?.startedAt ? { startedAt: extra.startedAt } : {}),
      ...(extra?.finishedAt ? { finishedAt: extra.finishedAt } : {}),
      ...(extra?.summary ? { summaryJson: JSON.stringify(extra.summary) } : {}),
    })
    .where(eq(jobs.id, jobId));
}

export async function listJobs(filters?: {
  platform?: Platform;
  status?: JobStatus;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const conditions: SQL[] = [];
  if (filters?.platform) conditions.push(eq(jobs.platform, filters.platform));
  if (filters?.status) conditions.push(eq(jobs.status, filters.status));
  if (filters?.dateFrom) conditions.push(gte(jobs.createdAt, filters.dateFrom));
  if (filters?.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(jobs.createdAt, end));
  }

  return db
    .select()
    .from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(jobs.createdAt))
    .limit(filters?.limit ?? 100);
}

export async function getJob(jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function getJobEvents(jobId: string) {
  return db
    .select()
    .from(jobEvents)
    .where(eq(jobEvents.jobId, jobId))
    .orderBy(jobEvents.createdAt);
}

export function getJobCredentials(job: { credentialsEnc: string }): JobCredentials {
  return decryptJson<JobCredentials>(job.credentialsEnc);
}

export async function getJobStats() {
  const all = await db.select().from(jobs);
  return {
    total: all.length,
    running: all.filter((j) => j.status === "running").length,
    success: all.filter((j) => j.status === "success").length,
    failed: all.filter((j) => j.status === "failed" || j.status === "partial").length,
  };
}
