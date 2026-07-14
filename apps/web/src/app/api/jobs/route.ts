import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createJob } from "@/lib/jobs/service";
import { logAudit, getClientIp } from "@/lib/audit/service";
import { PLATFORM_LABELS } from "@/lib/jobs/types";
import type { JobConfig, JobCredentials, Platform } from "@/lib/jobs/types";
import { z } from "zod";

const createJobSchema = z.object({
  platform: z.enum(["andrewbiggs", "edlearning", "speexx"]),
  credentials: z.record(z.string(), z.unknown()),
  config: z.record(z.string(), z.unknown()),
});

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { listJobs } = await import("@/lib/jobs/service");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const jobs = await listJobs({
    platform: (searchParams.get("platform") as Platform | null) ?? undefined,
    status: (searchParams.get("status") as never) ?? undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const jobId = await createJob({
    platform: parsed.data.platform,
    credentials: parsed.data.credentials as unknown as JobCredentials,
    config: parsed.data.config as unknown as JobConfig,
    createdBy: session.user.id,
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name,
    actorEmail: session.user.email,
    action: "job.create",
    resource: "job",
    resourceId: jobId,
    details: {
      platform: parsed.data.platform,
      platformLabel: PLATFORM_LABELS[parsed.data.platform],
      config: parsed.data.config,
    },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ jobId }, { status: 201 });
}
