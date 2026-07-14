import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAuditLogs, type AuditAction } from "@/lib/audit/service";
import { getUserRole } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || getUserRole(session.user) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") as AuditAction | null;
  const actorId = searchParams.get("actorId") ?? undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const logs = await listAuditLogs({
    action: action ?? undefined,
    actorId,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });

  return NextResponse.json({ logs });
}
