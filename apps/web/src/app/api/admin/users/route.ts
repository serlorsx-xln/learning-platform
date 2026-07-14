import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOperator, listUsers } from "@/lib/db/seed";
import { getUserRole } from "@/lib/session";
import { logAudit, getClientIp } from "@/lib/audit/service";

async function requireAdminApi(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  if (getUserRole(session.user) !== "admin") return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminApi(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminApi(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  await createOperator(body);

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name,
    actorEmail: session.user.email,
    action: "user.create",
    resource: "user",
    resourceId: body.email,
    details: { name: body.name, email: body.email, role: "operator" },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
