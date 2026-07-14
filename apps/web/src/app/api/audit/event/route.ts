import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit/service";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body.action === "logout" ? "auth.logout" : "auth.login";

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name,
    actorEmail: session.user.email,
    action,
    resource: "session",
    resourceId: session.user.id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
