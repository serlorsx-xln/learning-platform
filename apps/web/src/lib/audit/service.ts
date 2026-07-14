import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { AuditAction } from "@/lib/audit/types";

export type { AuditAction } from "@/lib/audit/types";
export { AUDIT_ACTION_LABELS } from "@/lib/audit/types";

interface LogAuditInput {
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function logAudit(input: LogAuditInput) {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: input.actorId,
    actorName: input.actorName,
    actorEmail: input.actorEmail,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId ?? null,
    detailsJson: input.details ? JSON.stringify(input.details) : null,
    ipAddress: input.ipAddress ?? null,
    createdAt: new Date(),
  });
}

export async function listAuditLogs(options?: {
  limit?: number;
  action?: AuditAction;
  actorId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const limit = options?.limit ?? 200;
  const conditions = [];

  if (options?.action) conditions.push(eq(auditLogs.action, options.action));
  if (options?.actorId) conditions.push(eq(auditLogs.actorId, options.actorId));
  if (options?.dateFrom) conditions.push(gte(auditLogs.createdAt, options.dateFrom));
  if (options?.dateTo) conditions.push(lte(auditLogs.createdAt, options.dateTo));

  const query = db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}
